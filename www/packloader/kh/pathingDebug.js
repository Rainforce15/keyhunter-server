import * as items from "./items.js"
import {resetPathingStatus} from "./pathing.js"

let indent = ""
let pathCount = 0

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
				console.log("valid entry point detected: ", loc.basename)
				loc.pathingStatus = 1
				entryPoints.push([map, loc])
			}
		}
	}
	console.log("Detected Entry Points: ", entryPoints.map(e=>`${e[0].basename}::${e[1].basename}`).join(",  "))
	//go forth and take the land
	for (let entryPoint of entryPoints) {
		let loc = entryPoint[1]
		console.log("starting from: ", loc.basename)
		pathCount = 0
		pathLoc(loc)
	}
}

function isEntryPoint(loc) {
	let locEntryPoint = loc["entryPoint"]
	if (locEntryPoint) {
		if (typeof locEntryPoint === "boolean") {
			console.log("simple entry point: ", loc.basename)
			return locEntryPoint
		} else {
			if (locEntryPoint.length > 0) console.log(`entry point ${loc.basename} testing factors: `)
			for (let factors of locEntryPoint) {
				console.log("    trying", JSON.stringify(factors))
				if (items.evaluateAnd(factors, `entryPoint of ${loc.basename}`)) {
					console.log("      valid factor.")
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
	let oneWayPropagation = false

	originalStatus = loc.pathingStatus
	indent += "    "
	pathDebugName = `${loc.parentMapName}::${loc.basename}`
	console.log(indent+"["+pathDebugName+"] pathing...")


	checkLocTwoWayConnections(loc, indent)
	oneWayPropagation = checkOneWayConnections(loc, oneWayPropagation, indent)

	if (oneWayPropagation) {
		console.log(`${indent}  propagate two-way connections due to one-way changes: ${Object.keys(loc["connectsTo"]).length}`, `[${++pathCount}]`)
		pathAllSub("connectsTo", loc, indent)
		console.log(`${indent}  propagate one-way connections due to one-way changes: ${Object.keys(loc["connectsOneWayTo"]).length}`, `[${++pathCount}]`)
		pathAllSub("connectsOneWayTo", loc, indent)
	}

	console.log(`${indent}[${loc.parentMapName}::${loc.basename}] resulting pathingStatus: `, `x/`, originalStatus, "->", loc.pathingStatus, `[${++pathCount}]`)
	indent = indent.substring(4)
}

function pathConnections(connection, oneWay) {
	let pathDebugName
	let originalStatus
	let oneWayPropagation = false
	let {src, ref} = connection

	originalStatus = ref.pathingStatus
	indent += "    "
	pathDebugName = `${ref.parentMapName}::${ref.basename}`
	//console.log(indent+"["+pathDebugName+"] pathing...")


	if (ref.pathingStatus === 1 || ref.pathingStatus === 2 && src.pathingStatus !== 1) {
		console.log(`${indent}[${pathDebugName}]  early escape - pathingStatus: `, ref.pathingStatus, `[${++pathCount}]`)
		indent = indent.substring(4)

		return ref.pathingStatus === 1
	}
	if (isEntryPoint(ref)) {
		ref.pathingStatus = 1
		connection.pathingStatus = 1
		console.log(`${indent}[${pathDebugName}]  early set (entry point) - pathingStatus: `, ref.pathingStatus, `[${++pathCount}]`)
	} else if (!oneWay) {
		let refOldStatus = ref.pathingStatus
		ref.pathingStatus = src.pathingStatus
		connection.pathingStatus = src.pathingStatus
		if (connection.connectionType === "connectsOneWayTo" && ref["connectsOneWayFrom"]?.[src.basename]) ref["connectsOneWayFrom"][src.basename].pathingStatus = src.pathingStatus
		else if (connection.connectionType === "connectsOneWayFrom" && ref["connectsOneWayTo"]?.[src.basename]) ref["connectsOneWayTo"][src.basename].pathingStatus = src.pathingStatus
		else if (ref["connectsTo"]?.[src.basename]) ref["connectsTo"][src.basename].pathingStatus = src.pathingStatus
		console.log(`${indent}[${pathDebugName}]  early set (connected) - pathingStatus: `, refOldStatus, "->", ref.pathingStatus, `[${++pathCount}]`)
		if (refOldStatus === 2 && ref.pathingStatus === 1) oneWayPropagation = true
	} else if (oneWay) {
		ref.pathingStatus = 2
		connection.pathingStatus = 2
		console.log(`${indent}[${pathDebugName}]  early set (one way) - pathingStatus: `, ref.pathingStatus, `[${++pathCount}]`)
	}

	checkLocTwoWayConnections(ref, indent)
	oneWayPropagation = checkOneWayConnections(ref, oneWayPropagation, indent)

	if (oneWayPropagation) {
		console.log(`${indent}  propagate two-way connections due to one-way changes: ${Object.keys(ref["connectsTo"]).length}`, `[${++pathCount}]`)
		pathAllSub("connectsTo", ref, indent)
		console.log(`${indent}  propagate one-way connections due to one-way changes: ${Object.keys(ref["connectsOneWayTo"]).length}`, `[${++pathCount}]`)
		pathAllSub("connectsOneWayTo", ref, indent)
	}

	console.log(`${indent}[${ref.parentMapName}::${ref.basename}] resulting pathingStatus: `, `${src.pathingStatus}/`, originalStatus, "->", ref.pathingStatus, `[${++pathCount}]`)
	indent = indent.substring(4)

	return ref.pathingStatus === 1
}

function checkLocTwoWayConnections(loc, indent) {
	let conCount = 0
	let locConnectsTo = loc["connectsTo"]
	if (locConnectsTo) console.log(`${indent}  two-way connections: ${Object.keys(locConnectsTo).length}`, `[${++pathCount}]`)
	for (let connectionName in locConnectsTo || {}) {
		let connection = locConnectsTo[connectionName]
		if (connection.ref) {
			console.log(`${indent}  ${++conCount}/${Object.keys(locConnectsTo).length} ${connection.ref.parentMapName}::${connection.ref.basename}`, `[${++pathCount}]`)
			basicPathing(connection)
		} else if (!connection._broken) {
			connection._broken = true
			console.warn(`broken ref: from ${loc.parentMapName}::${loc.basename} to ${connectionName.indexOf("::") < 0 ? loc.parentMapName + "::" : ""}${connectionName}`)
		}
	}
}

function checkOneWayConnections(loc, oneWayPropagation, indent) {
	let conCount = 0
	let locConnectsOneWayTo = loc["connectsOneWayTo"]
	if (locConnectsOneWayTo) console.log(`${indent}  one-way connections: ${Object.keys(locConnectsOneWayTo).length}`, `[${++pathCount}]`)
	for (let connectionName in locConnectsOneWayTo || {}) {
		console.log(`${indent}  ${++conCount}/${Object.keys(locConnectsOneWayTo).length} ${connectionName}`, `[${++pathCount}]`)
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
			console.log(`${indent}[${loc.parentMapName}::${loc.basename}] set after reconnecting one way - pathingStatus: `, prevStatus, "->", loc.pathingStatus, `[${++pathCount}]`)
			if (prevStatus === 2 && loc.pathingStatus === 1) oneWayPropagation = true
		}
		if (connection.ref.pathingStatus) return
		if (connection.length === 0) {
			oneWayPropagation = checkOneWayLoop(connection.ref, loc, indent)
		} else {
			for (let factors of connection) {
				if (items.evaluateAnd(factors, `connectsOneWayTo ${connectionName} of ${loc.basename}`)) {
					oneWayPropagation = checkOneWayLoop(connection.ref, loc, indent)
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

function checkOneWayLoop(connections, loc, indent) {
	if (pathConnections(connections, loc, true)) {
		let prevStatus = loc.pathingStatus
		loc.pathingStatus = 1
		console.log(`${indent}[${loc.parentMapName}::${loc.basename}] set after reconnecting one way - pathingStatus: `, prevStatus, "->", loc.pathingStatus, `[${++pathCount}]`)
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
			console.log(`${indent}  ${++conCount}/${Object.keys(connections).length} ${connection.ref.parentMapName}::${connection.ref.basename}`, `[${++pathCount}]`)
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
		if (!factorsFound) console.log(`${indent}   no valid factors.`, `[${++pathCount}]`)
	}
}
