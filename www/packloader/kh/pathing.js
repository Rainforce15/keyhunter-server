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
	 0: unreachable
	 1: reachable
	 2: reachable one way
 */

export function pathMaps(elements) {
	let entryPoints = []
	//clear pathing
	for (let mapName in elements) {
		let map = elements[mapName]
		for (let locName in map) {
			let loc = map[locName]
			if (loc === undefined) continue
			resetPathingStatus(loc)
			if (isEntryPoint(loc)) {
				if (_debug) console.log("valid entry point detected: ", loc.basename)
				loc.pathingStatus = 1
				entryPoints.push(loc)
			}
		}
	}
	if (_debug) console.log("Detected Entry Points: ", entryPoints.map(e=>`${e.parentMapName}::${e.basename}`).join(",  "))
	//go forth and take the land
	for (let loc of entryPoints) {
		if (_debug) console.log("starting from: ", loc.basename)
		pathCount = 0
		pathLoc(loc)
	}
	_debug = false
}

export function resetPathingStatus(loc) {
	loc.pathingStatus = 0
	for (let connectionName in loc["connectsTo"] || {}) {
		loc["connectsTo"][connectionName].pathingStatus = 0
	}
	for (let connectionName in loc["connectsOneWayTo"] || {}) {
		loc["connectsOneWayTo"][connectionName].pathingStatus = 0
	}
}

function isEntryPoint(loc) {
	let locEntryPoint = loc["entryPoint"]
	if (locEntryPoint) {
		if (typeof locEntryPoint === "boolean") {
			if (_debug) console.log("simple entry point: ", loc.basename)
			return locEntryPoint
		} else {
			if (_debug && locEntryPoint.length > 0) console.log(`entry point ${loc.basename} testing factors: `)
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
	let pathDebugName
	let originalStatus

	if (_debug) {
		originalStatus = loc.pathingStatus
		indent += "    "
		pathDebugName = `${loc.parentMapName}::${loc.basename}`
		console.log(indent+"["+pathDebugName+"] pathing...")
	}

	checkLocTwoWayConnections(loc, indent)
	let oneWayPropagation = checkOneWayConnections(loc, false, indent)

	if (oneWayPropagation) {
		if (_debug) console.log(`${indent}  propagate two-way connections due to one-way changes: ${Object.keys(loc["connectsTo"]).length}`, `[${++pathCount}]`)
		pathAllSub("connectsTo", loc, indent)
		if (_debug) console.log(`${indent}  propagate one-way connections due to one-way changes: ${Object.keys(loc["connectsOneWayTo"]).length}`, `[${++pathCount}]`)
		pathAllSub("connectsOneWayTo", loc, indent)
	}
	if (_debug) {
		console.log(`${indent}[${loc.parentMapName}::${loc.basename}] resulting pathingStatus: `, `x/`, originalStatus, "->", loc.pathingStatus, `[${++pathCount}]`)
		indent = indent.substring(4)
	}
}

function pathConnections(connection, startingPos, oneWay) {
	let pathDebugName
	let originalStatus
	let oneWayPropagation = false
	let src, ref
	if (startingPos === connection.src) {
		src = connection.src
		ref = connection.ref
	} else {
		src = connection.ref
		ref = connection.src
	}

	if (_debug) {
		originalStatus = ref.pathingStatus
		indent += "    "
		pathDebugName = `${ref.parentMapName}::${ref.basename}`
		//console.log(indent+"["+pathDebugName+"] pathing...")
	}


	if (ref.pathingStatus === 1 || ref.pathingStatus === 2 && src.pathingStatus !== 1) {
		if (_debug) {
			console.log(`${indent}[${pathDebugName}]  early escape - pathingStatus: `, ref.pathingStatus, `[${++pathCount}]`, connection)
			indent = indent.substring(4)
		}
		return ref.pathingStatus === 1
	}
	if (isEntryPoint(ref)) {
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

	checkLocTwoWayConnections(ref, indent)
	oneWayPropagation = checkOneWayConnections(ref, oneWayPropagation, indent)

	if (oneWayPropagation) {
		if (_debug) console.log(`${indent}  propagate two-way connections due to one-way changes: ${Object.keys(ref["connectsTo"]).length}`, `[${++pathCount}]`)
		pathAllSub("connectsTo", ref, indent)
		if (_debug) console.log(`${indent}  propagate one-way connections due to one-way changes: ${Object.keys(ref["connectsOneWayTo"]).length}`, `[${++pathCount}]`)
		pathAllSub("connectsOneWayTo", ref, indent)
	}

	if (_debug) {
		console.log(`${indent}[${ref.parentMapName}::${ref.basename}] resulting pathingStatus: `, `${src.pathingStatus}/`, originalStatus, "->", ref.pathingStatus, `[${++pathCount}]`)
		indent = indent.substring(4)
	}
	return ref.pathingStatus === 1
}

function checkLocTwoWayConnections(loc, indent) {
	let conCount = 0
	let locConnectsTo = loc["connectsTo"]
	if (_debug && locConnectsTo) console.log(`${indent}  two-way connections: ${Object.keys(locConnectsTo).length}`, `[${++pathCount}]`)
	for (let connectionName in locConnectsTo || {}) {
		let connection = locConnectsTo[connectionName]
		if (connection.ref) {
			if (_debug) console.log(`${indent}  ${++conCount}/${Object.keys(locConnectsTo).length} ${connection.ref.parentMapName}::${connection.ref.basename}`, `[${++pathCount}]`)
			basicPathing(connection, loc)
		} else if (!connection._broken) {
			connection._broken = true
			console.warn(`broken ref: from ${loc.parentMapName}::${loc.basename} to ${connectionName.indexOf("::") < 0 ? loc.parentMapName + "::" : ""}${connectionName}`)
		}
	}
}

function checkOneWayConnections(loc, oneWayPropagation, indent) {
	let conCount = 0
	let locConnectsOneWayTo = loc["connectsOneWayTo"]
	if (_debug && locConnectsOneWayTo) console.log(`${indent}  one-way connections: ${Object.keys(locConnectsOneWayTo).length}`, `[${++pathCount}]`)
	for (let connectionName in locConnectsOneWayTo || {}) {
		if (_debug) console.log(`${indent}  ${++conCount}/${Object.keys(locConnectsOneWayTo).length} ${connectionName}`, `[${++pathCount}]`)
		let connection = locConnectsOneWayTo[connectionName]
		let oneWayIndicator = checkOneWayConnection(connection, connectionName, oneWayPropagation, indent)
		if (oneWayIndicator !== undefined) oneWayPropagation = oneWayIndicator
	}
	return oneWayPropagation
}

function checkOneWayConnection(connection, connectionName, oneWayPropagation, indent) {
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
			oneWayPropagation = checkOneWayLoop(connection, loc, indent)
		} else {
			for (let factors of connection) {
				if (items.evaluateAnd(factors, `connectsOneWayTo ${connectionName} of ${loc.basename}`)) {
					oneWayPropagation = checkOneWayLoop(connection, loc, indent)
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

function checkOneWayLoop(connection, startingPos, indent) {
	if (pathConnections(connection, startingPos, true)) {
		let loc = connection.src
		let prevStatus = loc.pathingStatus
		loc.pathingStatus = 1
		if (_debug) console.log(`${indent}[${loc.parentMapName}::${loc.basename}] set after reconnecting one way - pathingStatus: `, prevStatus, "->", loc.pathingStatus, `[${++pathCount}]`)
		if (prevStatus === 2 && loc.pathingStatus === 1) return true
	}
	return false
}

function pathAllSub(connectionType, loc, indent) {
	let connections = loc[connectionType]
	let conCount = 0
	for (let connectionName in connections || {}) {
		let connection = connections[connectionName]
		if (connection.ref) {
			if (_debug) console.log(`${indent}  ${++conCount}/${Object.keys(connections).length} ${connection.ref.parentMapName}::${connection.ref.basename}`, `[${++pathCount}]`)
			basicPathing(connection, loc)
		}
	}
}

function basicPathing(connection, startingPos) {
	if (connection.length === 0) {
		pathConnections(connection, startingPos)
	} else {
		let factorsFound = false
		for (let factors of connection) {
			if (items.evaluateAnd(factors, `connectsTo ${connection.basename} of ${connection.src.basename}`)) {
				pathConnections(connection, startingPos)
				factorsFound = true
				break
			}
		}
		if (_debug && !factorsFound) console.log(`${indent}   no valid factors.`, `[${++pathCount}]`)
	}
}
