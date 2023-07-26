import * as items from "./items.js"
import * as pathingDebug from "./pathingDebug.js"

let indent = ""
let pathCount = 0
export let _debug = false
export function debug(value) {
	if (value === undefined) {
		return _debug
	} else {
		_debug = value
	}
}

/*
	 0: unreachable
	 1: reachable
	 2: reachable one way
 */

export function path(elements) {
	if (_debug) pathingDebug.pathMaps(elements)
	else pathMaps(elements)
	_debug = false
}

function pathMaps(elements) {
	let entryPoints = []
	//clear pathing
	for (let mapName in elements) {
		let map = elements[mapName]
		for (let locName in map) {
			let loc = map[locName]
			if (loc === undefined) continue
			resetPathingStatus(map[locName])
			if (isEntryPoint(loc)) {
				loc.pathingStatus = 1
				entryPoints.push([map, loc])
			}
		}
	}
	//go forth and take the land
	for (let entryPoint of entryPoints) {
		let loc = entryPoint[1]
		pathCount = 0
		pathLoc(loc)
	}
}

export function resetPathingStatus(loc) {
	loc.pathingStatus = 0
	for (let connectionName in loc["connectsTo"] || {}) {
		loc["connectsTo"][connectionName].pathingStatus = 0
	}
	for (let connectionName in loc["connectsOneWayTo"] || {}) {
		loc["connectsOneWayTo"][connectionName].pathingStatus = 0
	}
	for (let connectionName in loc["connectsOneWayFrom"] || {}) {
		loc["connectsOneWayFrom"][connectionName].pathingStatus = 0
	}
}

function isEntryPoint(loc) {
	let locEntryPoint = loc["entryPoint"]
	if (locEntryPoint) {
		if (typeof locEntryPoint === "boolean") {
			return locEntryPoint
		} else {
			for (let factors of locEntryPoint) {
				if (items.evaluateAnd(factors, `entryPoint of ${loc.basename}`)) {
					return true
				}
			}
		}
	}
	return false
}

function pathLoc(loc) {
	let oneWayPropagation = false

	checkLocTwoWayConnections(loc, indent)
	oneWayPropagation = checkOneWayConnections(loc, oneWayPropagation, indent)

	if (oneWayPropagation) {
		pathAllSub("connectsTo", loc, indent)
		pathAllSub("connectsOneWayTo", loc, indent)
	}
}

function pathConnections(connection, oneWay) {
	let oneWayPropagation = false
	let {src, ref} = connection

	if (ref.pathingStatus === 1 || ref.pathingStatus === 2 && src.pathingStatus !== 1) {
		return ref.pathingStatus === 1
	}
	if (isEntryPoint(ref)) {
		ref.pathingStatus = 1
		connection.pathingStatus = 1
	} else if (!oneWay) {
		let refOldStatus = ref.pathingStatus
		ref.pathingStatus = src.pathingStatus
		connection.pathingStatus = src.pathingStatus
		if (connection.connectionType === "connectsOneWayTo" && ref["connectsOneWayFrom"]?.[src.basename]) ref["connectsOneWayFrom"][src.basename].pathingStatus = src.pathingStatus
		else if (connection.connectionType === "connectsOneWayFrom" && ref["connectsOneWayTo"]?.[src.basename]) ref["connectsOneWayTo"][src.basename].pathingStatus = src.pathingStatus
		else if (ref["connectsTo"]?.[src.basename]) ref["connectsTo"][src.basename].pathingStatus = src.pathingStatus
		if (refOldStatus === 2 && ref.pathingStatus === 1) oneWayPropagation = true
	} else if (oneWay) {
		ref.pathingStatus = 2
		connection.pathingStatus = 2
	}

	checkLocTwoWayConnections(ref, indent)
	oneWayPropagation = checkOneWayConnections(ref, oneWayPropagation, indent)

	if (oneWayPropagation) {
		pathAllSub("connectsTo", ref, indent)
		pathAllSub("connectsOneWayTo", ref, indent)
	}
	return ref.pathingStatus === 1
}

function checkLocTwoWayConnections(loc) {
	let locConnectsTo = loc["connectsTo"]
	for (let connectionName in locConnectsTo || {}) {
		let connection = locConnectsTo[connectionName]
		if (connection.ref) {
			basicPathing(connection)
		} else if (!connection._broken) {
			connection._broken = true
			console.warn(`broken ref: from ${loc.parentMapName}::${loc.basename} to ${connectionName.indexOf("::") < 0 ? loc.parentMapName + "::" : ""}${connectionName}`)
		}
	}
}

function checkOneWayConnections(loc, oneWayPropagation, indent) {
	let locConnectsOneWayTo = loc["connectsOneWayTo"]
	for (let connectionName in locConnectsOneWayTo || {}) {
		let connection = locConnectsOneWayTo[connectionName]
		let oneWayIndicator = checkOneWayConnection(connection, connectionName, oneWayPropagation, indent)
		if (oneWayIndicator !== undefined) oneWayPropagation = oneWayIndicator
	}
	return oneWayPropagation
}

function checkOneWayConnection(connection, connectionName, oneWayPropagation) {
	let loc = connection.src
	if (connection.ref) {
		if (connection.ref.pathingStatus === 1) {
			let prevStatus = loc.pathingStatus
			loc.pathingStatus = 1
			connection.pathingStatus = 1
			if (prevStatus === 2 && loc.pathingStatus === 1) oneWayPropagation = true
		}
		if (connection.ref.pathingStatus) return
		if (connection.length === 0) {
			oneWayPropagation = checkOneWayLoop(connection.ref, loc)
		} else {
			for (let factors of connection) {
				if (items.evaluateAnd(factors, `connectsOneWayTo ${connectionName} of ${loc.basename}`)) {
					oneWayPropagation = checkOneWayLoop(connection.ref, loc)
					break
				}
			}
		}
	} else if (!connection._broken) {
		connection._broken = true
		console.warn(`broken ref: from ${loc.parentMapName}::${loc.basename} to ${connectionName.indexOf("::") < 0 ? loc.parentMapName + "::" : ""}${connectionName}`)
	}
	return oneWayPropagation
}

function checkOneWayLoop(connections, loc) {
	if (pathConnections(connections, loc, true)) {
		let prevStatus = loc.pathingStatus
		loc.pathingStatus = 1
		if (prevStatus === 2 && loc.pathingStatus === 1) return true
	}
	return false
}

function pathAllSub(connectionType, loc) {
	let connections = loc[connectionType]
	for (let connectionName in connections || {}) {
		let connection = connections[connectionName]
		if (connection.ref) {
			basicPathing(connection)
		}
	}
}

function basicPathing(connection) {
	if (connection.length === 0) {
		pathConnections(connection)
	} else {
		let factorsFound = false
		for (let factors of connection) {
			if (items.evaluateAnd(factors, `connectsTo ${connection.basename} of ${connection.src.basename}`)) {
				pathConnections(connection)
				factorsFound = true
				break
			}
		}
	}
}

export function setupEntryPaths(elements) {
	console.log("Entry Pathing Check ...")
	let entryPoints = []
	console.log("clearing connectedToEntryPoint")
	for (let mapName in elements) {
		let map = elements[mapName]
		for (let locName in map) {
			let loc = map[locName]
			if (loc === undefined) continue
			loc.connectedToEntryPoint = false
			if (loc["entryPoint"]) entryPoints.push([map, loc])
		}
	}
	console.log("validating...")
	for (let entryPoint of entryPoints) {
		let loc = entryPoint[1]
		loc.connectedToEntryPoint = true
		propagateEntryConnectionForAll(loc["connectsTo"])
		propagateEntryConnectionForAll(loc["connectsOneWayTo"])
	}
}

function propagateEntryConnectionForAll(connectionList) {
	for (let connectionName in connectionList) {
		if (connectionList[connectionName].ref) propagateEntryConnection(connectionList[connectionName])
	}
}

function propagateEntryConnection(con) {
	if (!con.connectedToEntryPoint) {
		con.connectedToEntryPoint = true
	}
	let loc = con.ref
	if (!loc.connectedToEntryPoint) {
		loc.connectedToEntryPoint = true
		propagateEntryConnectionForAll(loc["connectsTo"])
		propagateEntryConnectionForAll(loc["connectsOneWayTo"])
	}
}
