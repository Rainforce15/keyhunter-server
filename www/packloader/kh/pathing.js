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
export function pathMaps(elements) {
	let entryPoints = []
	//clear pathing
	for (let mapName in elements) {
		let map = elements[mapName]
		let mapLocations = map["locations"]
		if (mapLocations) {
			for (let locName in mapLocations) {
				let loc = mapLocations[locName]
				if (loc === undefined) continue
				loc.pathingStatus = 0
				if (isEntryPoint(loc)) entryPoints.push([map, loc])
			}
		}
	}
	if (_debug) console.log("Detected Entry Points: ", entryPoints.map(e=>`${e[0].basename}::${e[1].basename}`).join(",  "))
	//go forth and take the land
	for (let entryPoint of entryPoints) {
		let loc = entryPoint[1]
		if (_debug) console.log("starting from: ", loc.basename)
		pathCount = 0
		pathConnections(loc)
	}
	//round up the remainders
	for (let mapName in elements) {
		let map = elements[mapName]
		let mapLocations = map["locations"]
		if (mapLocations) {
			for (let locName in mapLocations) {
				let loc = mapLocations[locName]
				if (loc === undefined) continue
				if (loc.pathingStatus === 0) loc.pathingStatus = -1
			}
		}
	}
	_debug = false
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
function pathConnections(loc, prev, oneWay) {
	let pathDebugName
	let originalStatus
	let oneWayPropagation = false
	if (_debug) {
		originalStatus = loc.pathingStatus
		indent += "    "
		pathDebugName = `${loc.parentMapName}::${loc.basename}`
		//console.log(indent+"["+pathDebugName+"] pathing...")
	}

	if (loc.pathingStatus && (loc.pathingStatus === 1 || loc.pathingStatus === 2 && prev.pathingStatus !== 1)) {
		if (_debug) {
			console.log(`${indent}[${pathDebugName}]  early escape - pathingStatus: `, loc.pathingStatus, `[${++pathCount}]`)
			indent = indent.substring(4)
		}
		return loc.pathingStatus === 1
	}
	if (isEntryPoint(loc)) loc.pathingStatus = 1
	else if (prev && !oneWay) {
		let prevStatus = loc.pathingStatus
		loc.pathingStatus = prev.pathingStatus
		if (_debug) console.log(`${indent}[${pathDebugName}]  early set (connected) - pathingStatus: `, prevStatus, "->", loc.pathingStatus, `[${++pathCount}]`)
		if (prevStatus === 2 && loc.pathingStatus === 1) oneWayPropagation = true
	}
	else if (oneWay) {
		loc.pathingStatus = 2
		if (_debug) console.log(`${indent}[${pathDebugName}]  early set (one way) - pathingStatus: `, loc.pathingStatus, `[${++pathCount}]`)
	}

	checkTwoWayConnections(loc, indent)
	oneWayPropagation = checkOneWayConnections(loc, oneWayPropagation, indent)

	if (oneWayPropagation) {
		let locConnectsTo = loc["connectsTo"]
		if (locConnectsTo) {
			if (_debug) console.log(`${indent}  propagate two-way connections due to one-way changes: ${Object.keys(locConnectsTo).length}`, `[${++pathCount}]`)
			pathAllSub(locConnectsTo, loc, indent)
		}
		let locConnectsOneWayTo = loc["connectsOneWayTo"]
		if (locConnectsOneWayTo) {
			if (_debug) console.log(`${indent}  propagate one-way connections due to one-way changes: ${Object.keys(locConnectsOneWayTo).length}`, `[${++pathCount}]`)
			pathAllSub(locConnectsOneWayTo, loc, indent)
		}
	}
	if (_debug) {
		console.log(`${indent}[${loc.parentMapName}::${loc.basename}] resulting pathingStatus: `, `${prev?prev.pathingStatus:"x"}/`, originalStatus, "->", loc.pathingStatus, `[${++pathCount}]`)
		indent = indent.substring(4)
	}
	return loc.pathingStatus === 1
}
function checkTwoWayConnections(loc, indent) {
	let conCount = 0
	let locConnectsTo = loc["connectsTo"]
	if (_debug && locConnectsTo) console.log(`${indent}  two-way connections: ${Object.keys(locConnectsTo).length}`, `[${++pathCount}]`)
	for (let connectionName in locConnectsTo || []) {
		let connectionData = locConnectsTo[connectionName]
		if (connectionData.ref) {
			if (_debug) console.log(`${indent}  ${++conCount}/${Object.keys(locConnectsTo).length} ${connectionData.ref.parentMapName}::${connectionData.ref.basename}`, `[${++pathCount}]`)
			if (connectionData.length === 0) {
				pathConnections(connectionData.ref, loc)
			} else {
				let factorsFound = false
				for (let factors of connectionData) {
					if (items.evaluateAnd(factors, `connectsTo ${connectionName} of ${loc.basename}`)) {
						pathConnections(connectionData.ref, loc)
						factorsFound = true
						break
					}
				}
				if (_debug && !factorsFound) console.log(`${indent}   no valid factors.`, `[${++pathCount}]`)
			}
		} else {
			if (!connectionData._broken) {
				connectionData._broken = true
				console.warn(`broken ref: from ${loc.parentMapName}::${loc.basename} to ${connectionName.indexOf("::") < 0 ? loc.parentMapName + "::" : ""}${connectionName}`)

			}
		}
	}
}
function checkOneWayConnections(loc, oneWayPropagation, indent) {
	let conCount = 0
	let locConnectsOneWayTo = loc["connectsOneWayTo"]
	if (_debug && locConnectsOneWayTo) console.log(`${indent}  one-way connections: ${Object.keys(locConnectsOneWayTo).length}`, `[${++pathCount}]`)
	for (let connectionName in locConnectsOneWayTo || []) {
		if (_debug) console.log(`${indent}  ${++conCount}/${Object.keys(locConnectsOneWayTo).length} ${connectionName}`, `[${++pathCount}]`)
		let connectionData = locConnectsOneWayTo[connectionName]
		if (connectionData.ref) {
			if (connectionData.ref.pathingStatus === 1) {
				let prevStatus = loc.pathingStatus
				loc.pathingStatus = 1
				if (_debug) console.log(`${indent}[${loc.parentMapName}::${loc.basename}] set after reconnecting one way - pathingStatus: `, prevStatus, "->", loc.pathingStatus, `[${++pathCount}]`)
				if (prevStatus === 2 && loc.pathingStatus === 1) oneWayPropagation = true
			}
			if (connectionData.ref.pathingStatus) continue
			if (connectionData.length === 0) {
				oneWayPropagation = checkOneWayLoop(connectionData.ref, loc, indent)
			} else {
				for (let factors of connectionData) {
					if (items.evaluateAnd(factors, `connectsOneWayTo ${connectionName} of ${loc.basename}`)) {
						oneWayPropagation = checkOneWayLoop(connectionData.ref, loc, indent)
						break
					}
				}
			}
		} else {
			if (!connectionData._broken) {
				connectionData._broken = true
				console.warn(`broken ref: from ${loc.parentMapName}::${loc.basename} to ${connectionName.indexOf("::") < 0 ? loc.parentMapName + "::" : ""}${connectionName}`)
			}
		}
	}
	return oneWayPropagation
}
function checkOneWayLoop(connections, loc, indent) {
	if (pathConnections(connections, loc, true)) {
		let prevStatus = loc.pathingStatus
		loc.pathingStatus = 1
		if (_debug) console.log(`${indent}[${loc.parentMapName}::${loc.basename}] set after reconnecting one way - pathingStatus: `, prevStatus, "->", loc.pathingStatus, `[${++pathCount}]`)
		if (prevStatus === 2 && loc.pathingStatus === 1) return true
	}
	return false
}
function pathAllSub(connections, loc, indent) {
	let conCount = 0
	for (let connectionName in connections) {
		let connectionData = connections[connectionName]
		if (connectionData.ref) {
			if (_debug) console.log(`${indent}  ${++conCount}/${Object.keys(connections).length} ${connectionData.ref.parentMapName}::${connectionData.ref.basename}`, `[${++pathCount}]`)
			if (connectionData.length === 0) {
				pathConnections(connectionData.ref, loc)
			} else {
				let factorsFound = false
				for (let factors of connectionData) {
					if (items.evaluateAnd(factors, `connectsTo ${connectionName} of ${loc.basename}`)) {
						pathConnections(connectionData.ref, loc)
						factorsFound = true
						break
					}
				}
				if (_debug && !factorsFound) console.log(`${indent}   no valid factors.`, `[${++pathCount}]`)
			}
		}
	}
}

export function checkPaths(elements) {
	console.log("Pathing Check ...")
	let entryPoints = []
	console.log("clearing connectedToEntryPoint")
	for (let mapName in elements) {
		let map = elements[mapName]
		let mapLocations = map["locations"]
		if (mapLocations) {
			for (let locName in mapLocations) {
				let loc = mapLocations[locName]
				if (loc === undefined) continue
				loc.connectedToEntryPoint = false
				if (loc["entryPoint"]) entryPoints.push([map, loc])
			}
		}
	}
	console.log("validating...")
	for (let entryPoint of entryPoints) {
		let loc = entryPoint[1]
		checkConnections(loc)
	}
}

function checkConnections(loc) {
	if (!loc.connectedToEntryPoint) {
		loc.connectedToEntryPoint = true
		let locConnectsTo = loc["connectsTo"]
		for (let connectionName in locConnectsTo) {
			if (locConnectsTo[connectionName].ref) checkConnections(locConnectsTo[connectionName].ref)
		}
		let locConnectsOneWayTo = loc["connectsOneWayTo"]
		for (let connectionName in locConnectsOneWayTo) {
			if (locConnectsOneWayTo[connectionName].ref) checkConnections(locConnectsOneWayTo[connectionName].ref)
		}
	}
}
