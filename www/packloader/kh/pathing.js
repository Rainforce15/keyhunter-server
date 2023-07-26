import * as items from "./items.js"

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
	 0: undecided
	-1: unreachable
	 1: reachable
	 2: reachable one way
 */

export function path(elements) {
	if (_debug) pathMapsDebug(elements)
	else pathMaps(elements)
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
	//round up the remainders
	for (let mapName in elements) {
		let map = elements[mapName]
		for (let locName in map) {
			let loc = map[locName]
			if (loc === undefined) continue
			if (loc.pathingStatus === 0) loc.pathingStatus = -1
			for (let connectionName in loc["connectsTo"] || {}) {
				if (loc["connectsTo"][connectionName].pathingStatus === 0) loc["connectsTo"][connectionName].pathingStatus = -1
			}
			for (let connectionName in loc["connectsOneWayTo"] || {}) {
				if (loc["connectsOneWayTo"][connectionName].pathingStatus === 0) loc["connectsOneWayTo"][connectionName].pathingStatus = -1
			}
			for (let connectionName in loc["connectsOneWayFrom"] || {}) {
				if (loc["connectsOneWayFrom"][connectionName].pathingStatus === 0) loc["connectsOneWayFrom"][connectionName].pathingStatus = -1
			}
		}
	}
}


function pathMapsDebug(elements) {
	let entryPoints = []
	//clear pathing
	for (let mapName in elements) {
		let map = elements[mapName]
		for (let locName in map) {
			let loc = map[locName]
			if (loc === undefined) continue
			resetPathingStatus(loc)
			if (isEntryPointDebug(loc)) {
				if (_debug) console.log("valid entry point detected: ", loc.basename)
				loc.pathingStatus = 1
				entryPoints.push([map, loc])
			}
		}
	}
	if (_debug) console.log("Detected Entry Points: ", entryPoints.map(e=>`${e[0].basename}::${e[1].basename}`).join(",  "))
	//go forth and take the land
	for (let entryPoint of entryPoints) {
		let loc = entryPoint[1]
		if (_debug) console.log("starting from: ", loc.basename)
		pathCount = 0
		pathLocDebug(loc)
	}
	//round up the remainders
	for (let mapName in elements) {
		let map = elements[mapName]
		for (let locName in map) {
			let loc = map[locName]
			if (loc === undefined) continue
			if (loc.pathingStatus === 0) loc.pathingStatus = -1
			for (let connectionName in loc["connectsTo"] || {}) {
				if (loc["connectsTo"][connectionName].pathingStatus === 0) loc["connectsTo"][connectionName].pathingStatus = -1
			}
			for (let connectionName in loc["connectsOneWayTo"] || {}) {
				if (loc["connectsOneWayTo"][connectionName].pathingStatus === 0) loc["connectsOneWayTo"][connectionName].pathingStatus = -1
			}
			for (let connectionName in loc["connectsOneWayFrom"] || {}) {
				if (loc["connectsOneWayFrom"][connectionName].pathingStatus === 0) loc["connectsOneWayFrom"][connectionName].pathingStatus = -1
			}
		}
	}
	_debug = false
}

function resetPathingStatus(loc) {
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

function isEntryPointDebug(loc) {
	let locEntryPoint = loc["entryPoint"]
	if (locEntryPoint) {
		if (typeof locEntryPoint === "boolean") {
			if (_debug) console.log("simple entry point: ", loc.basename)
			return locEntryPoint
		} else {
			if (_debug) console.log(`entry point ${loc.basename} testing factors: `)
			for (let factors of locEntryPoint) {
				if (_debug) console.log("    trying", JSON.stringify(factors))
				if (items.evaluateAnd(factors, `entryPoint of ${loc.basename}`)) {
					if (_debug) console.log("      valid factor.")
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

function pathLocDebug(loc) {
	let pathDebugName
	let originalStatus
	let oneWayPropagation = false
	if (_debug) {
		originalStatus = loc.pathingStatus
		indent += "    "
		pathDebugName = `${loc.parentMapName}::${loc.basename}`
		console.log(indent+"["+pathDebugName+"] pathing...")
	}

	checkLocTwoWayConnectionsDebug(loc, indent)
	oneWayPropagation = checkOneWayConnectionsDebug(loc, oneWayPropagation, indent)

	if (oneWayPropagation) {
		if (_debug) console.log(`${indent}  propagate two-way connections due to one-way changes: ${Object.keys(loc["connectsTo"]).length}`, `[${++pathCount}]`)
		pathAllSubDebug("connectsTo", loc, indent)
		if (_debug) console.log(`${indent}  propagate one-way connections due to one-way changes: ${Object.keys(loc["connectsOneWayTo"]).length}`, `[${++pathCount}]`)
		pathAllSubDebug("connectsOneWayTo", loc, indent)
	}
	if (_debug) {
		console.log(`${indent}[${loc.parentMapName}::${loc.basename}] resulting pathingStatus: `, `x/`, originalStatus, "->", loc.pathingStatus, `[${++pathCount}]`)
		indent = indent.substring(4)
	}
}

function pathConnections(connection, oneWay) {
	let oneWayPropagation = false
	let {ref, src} = connection

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

function pathConnectionsDebug(connection, oneWay) {
	let pathDebugName
	let originalStatus
	let oneWayPropagation = false
	let {ref, src} = connection
	if (_debug) {
		originalStatus = ref.pathingStatus
		indent += "    "
		pathDebugName = `${ref.parentMapName}::${ref.basename}`
		//console.log(indent+"["+pathDebugName+"] pathing...")
	}

	if (ref.pathingStatus === 1 || ref.pathingStatus === 2 && src.pathingStatus !== 1) {
		if (_debug) {
			console.log(`${indent}[${pathDebugName}]  early escape - pathingStatus: `, ref.pathingStatus, `[${++pathCount}]`)
			indent = indent.substring(4)
		}
		return ref.pathingStatus === 1
	}
	if (isEntryPointDebug(ref)) {
		ref.pathingStatus = 1
		connection.pathingStatus = 1
		if (_debug) console.log(`${indent}[${pathDebugName}]  early set (entry point) - pathingStatus: `, ref.pathingStatus, `[${++pathCount}]`)
	} else if (!oneWay) {
		let refOldStatus = ref.pathingStatus
		ref.pathingStatus = src.pathingStatus
		connection.pathingStatus = src.pathingStatus
		if (_debug) console.log(`${indent}[${pathDebugName}]  early set (connected) - pathingStatus: `, refOldStatus, "->", ref.pathingStatus, `[${++pathCount}]`)
		if (refOldStatus === 2 && ref.pathingStatus === 1) oneWayPropagation = true
	} else if (oneWay) {
		ref.pathingStatus = 2
		connection.pathingStatus = 2
		if (_debug) console.log(`${indent}[${pathDebugName}]  early set (one way) - pathingStatus: `, ref.pathingStatus, `[${++pathCount}]`)
	}

	checkLocTwoWayConnectionsDebug(ref, indent)
	oneWayPropagation = checkOneWayConnectionsDebug(ref, oneWayPropagation, indent)

	if (oneWayPropagation) {
		if (_debug) console.log(`${indent}  propagate two-way connections due to one-way changes: ${Object.keys(ref["connectsTo"]).length}`, `[${++pathCount}]`)
		pathAllSubDebug("connectsTo", ref, indent)
		if (_debug) console.log(`${indent}  propagate one-way connections due to one-way changes: ${Object.keys(ref["connectsOneWayTo"]).length}`, `[${++pathCount}]`)
		pathAllSubDebug("connectsOneWayTo", ref, indent)
	}
	if (_debug) {
		console.log(`${indent}[${ref.parentMapName}::${ref.basename}] resulting pathingStatus: `, `${src.pathingStatus}/`, originalStatus, "->", ref.pathingStatus, `[${++pathCount}]`)
		indent = indent.substring(4)
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

function checkLocTwoWayConnectionsDebug(loc, indent) {
	let conCount = 0
	let locConnectsTo = loc["connectsTo"]
	if (_debug && locConnectsTo) console.log(`${indent}  two-way connections: ${Object.keys(locConnectsTo).length}`, `[${++pathCount}]`)
	for (let connectionName in locConnectsTo || {}) {
		let connection = locConnectsTo[connectionName]
		if (connection.ref) {
			if (_debug) console.log(`${indent}  ${++conCount}/${Object.keys(locConnectsTo).length} ${connection.ref.parentMapName}::${connection.ref.basename}`, `[${++pathCount}]`)
			basicPathingDebug(connection)
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

function checkOneWayConnectionsDebug(loc, oneWayPropagation, indent) {
	let conCount = 0
	let locConnectsOneWayTo = loc["connectsOneWayTo"]
	if (_debug && locConnectsOneWayTo) console.log(`${indent}  one-way connections: ${Object.keys(locConnectsOneWayTo).length}`, `[${++pathCount}]`)
	for (let connectionName in locConnectsOneWayTo || {}) {
		if (_debug) console.log(`${indent}  ${++conCount}/${Object.keys(locConnectsOneWayTo).length} ${connectionName}`, `[${++pathCount}]`)
		let connection = locConnectsOneWayTo[connectionName]
		let oneWayIndicator = checkOneWayConnectionDebug(connection, connectionName, oneWayPropagation, indent)
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

function checkOneWayConnectionDebug(connection, connectionName, oneWayPropagation, indent) {
	let loc = connection.src
	if (connection.ref) {
		if (connection.ref.pathingStatus === 1) {
			let prevStatus = loc.pathingStatus
			loc.pathingStatus = 1
			connection.pathingStatus = 1
			if (_debug) console.log(`${indent}[${loc.parentMapName}::${loc.basename}] set after reconnecting one way - pathingStatus: `, prevStatus, "->", loc.pathingStatus, `[${++pathCount}]`)
			if (prevStatus === 2 && loc.pathingStatus === 1) oneWayPropagation = true
		}
		if (connection.ref.pathingStatus) return
		if (connection.length === 0) {
			oneWayPropagation = checkOneWayLoopDebug(connection.ref, loc, indent)
		} else {
			for (let factors of connection) {
				if (items.evaluateAnd(factors, `connectsOneWayTo ${connectionName} of ${loc.basename}`)) {
					oneWayPropagation = checkOneWayLoopDebug(connection.ref, loc, indent)
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

function checkOneWayLoopDebug(connections, loc, indent) {
	if (pathConnectionsDebug(connections, loc, true)) {
		let prevStatus = loc.pathingStatus
		loc.pathingStatus = 1
		if (_debug) console.log(`${indent}[${loc.parentMapName}::${loc.basename}] set after reconnecting one way - pathingStatus: `, prevStatus, "->", loc.pathingStatus, `[${++pathCount}]`)
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

function pathAllSubDebug(connectionType, loc, indent) {
	let connections = loc[connectionType]
	let conCount = 0
	for (let connectionName in connections || {}) {
		let connection = connections[connectionName]
		if (connection.ref) {
			if (_debug) console.log(`${indent}  ${++conCount}/${Object.keys(connections).length} ${connection.ref.parentMapName}::${connection.ref.basename}`, `[${++pathCount}]`)
			basicPathingDebug(connection)
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

function basicPathingDebug(connection) {
	if (connection.length === 0) {
		pathConnectionsDebug(connection)
	} else {
		let factorsFound = false
		for (let factors of connection) {
			if (items.evaluateAnd(factors, `connectsTo ${connection.basename} of ${connection.src.basename}`)) {
				pathConnectionsDebug(connection)
				factorsFound = true
				break
			}
		}
		if (_debug && !factorsFound) console.log(`${indent}   no valid factors.`, `[${++pathCount}]`)
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
