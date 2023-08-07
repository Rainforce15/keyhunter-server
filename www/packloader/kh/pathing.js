import * as items from "./items.js"

let indent = ""
let traceLog
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
	 1: reachable one way
	 2: reachable
 */

function trace(msgGenerator) {
	if (_debug) traceLog += msgGenerator() + "\n"
}

export function pathMaps(elements) {
	let entryPoints = []
	if (_debug) traceLog = ""
	//clear pathing
	for (let mapName in elements) {
		let map = elements[mapName]
		for (let locName in map) {
			let loc = map[locName]
			resetPathingStatus(loc)
			if (isEntryPoint(loc)) {
				trace(_ => "valid entry point detected: " + loc.basename)
				loc.pathingStatus = 2
				entryPoints.push(loc)
			}
		}
	}
	trace(_ => "Detected Entry Points: " + entryPoints.map(e=>`${e.parentMapName}::${e.basename}`).join(",  "))
	//go forth and take the land
	for (let loc of entryPoints) {
		trace(_ => "starting from: " + loc.basename)
		pathCount = 0
		pathLoc(loc)
	}
	if (_debug) console.log(traceLog)
	_debug = false
}

function resetPathingStatus(loc) {
	loc.pathingStatus = 0
	let connectsTo = loc["connectsTo"]
	if (connectsTo) for (let conName in connectsTo) {
		connectsTo[conName].pathingStatus = 0
	}
	let connectsOneWayTo = loc["connectsOneWayTo"]
	if (connectsOneWayTo) for (let conName in connectsOneWayTo) {
		connectsOneWayTo[conName].pathingStatus = 0
	}
}

function isEntryPoint(loc) {
	let locEntryPoint = loc["entryPoint"]
	if (locEntryPoint) {
		if (typeof locEntryPoint === "boolean") {
			trace(_ => "simple entry point: " + loc.basename)
			return locEntryPoint
		} else {
			if (locEntryPoint.length > 0) trace(_ => `entry point ${loc.basename} testing factors: `)
			for (let i = 0; i < locEntryPoint.length; i++) {
				let factors = locEntryPoint[i]
				trace(_ => "    trying" + JSON.stringify(factors))
				if (items.evaluateAnd(factors, `entryPoint of ${loc.basename}`)) {
					trace(_ => "      valid factors.")
					return true
				}
			}
		}
	}
	return false
}

function pathLoc(loc) {
	if (_debug) {
		trace(_ => indent + "pathing: " + loc.basename)
		indent += "  "
	}

	pathConnectsTo(loc["connectsTo"] || {}, loc)
	pathConnectsOneWayTo(loc["connectsOneWayTo"] || {}, loc)
	pathConnectsOneWayFrom(loc["connectsOneWayFrom"] || {}, loc)

	if (_debug) indent = indent.slice(2)
	return loc.pathingStatus
}

function pathConnectsTo(connectsTo, loc) {
	for (let conName in connectsTo) {
		trace(_ => indent + "connecting to: " + conName)
		let con = connectsTo[conName]
		let ref = con.src === loc ? con.ref : con.src;

		if (hasValidFactors(con, loc, ref)) {
			if (ref.pathingStatus < loc.pathingStatus) {
				ref.pathingStatus = loc.pathingStatus
				pathLoc(ref)
			}
			trace(_ => indent + `  updating status of ${loc.basename}: ${loc.pathingStatus} -> ${ref.pathingStatus}, ${conName}: ${con.pathingStatus} -> ${ref.pathingStatus}`)
			loc.pathingStatus = ref.pathingStatus
			con.pathingStatus = ref.pathingStatus
		}
	}
}

function pathConnectsOneWayTo(connectsOneWayTo, loc) {
	for (let conName in connectsOneWayTo) {
		trace(_ => indent + "connecting oneway to: " + conName)
		let con = connectsOneWayTo[conName]
		let ref = con.ref

		if (hasValidFactors(con, loc, ref)) {
			if (ref.pathingStatus < 2) {
				ref.pathingStatus = 1
				trace(_ => indent + `  prelimanary status of ${conName}: ${con.pathingStatus} -> ${ref.pathingStatus}`)
				pathLoc(ref)
			} else {
				if (loc.pathingStatus < ref.pathingStatus) {
					trace(_ => indent + `  right hand location already pathed and superior; updating status of ${loc.basename}: ${loc.pathingStatus} -> ${ref.pathingStatus}, redoing everything`)
					loc.pathingStatus = ref.pathingStatus
					pathLoc(loc)
				} else {
					trace(_ => indent + "  right hand location already pathed and equal.")
				}
			}
			trace(_ => indent + `  updating status of ${conName}: ${con.pathingStatus} -> ${ref.pathingStatus}`)
			con.pathingStatus = ref.pathingStatus
		}
	}
}

function pathConnectsOneWayFrom(connectsOneWayFrom, loc) {
	for (let conName in connectsOneWayFrom) {
		trace(_ => indent + "connecting oneway from: " + conName)
		let con = connectsOneWayFrom[conName]
		let src = con.src
		let ref = loc
		if (src.pathingStatus === 1 && ref.pathingStatus === 2) {
			trace(_ => indent + `  updating status of ${src.basename}: ${src.pathingStatus} -> ${ref.pathingStatus}`)
			trace(_ => indent + `  updating status of ${conName}: ${con.pathingStatus} -> ${ref.pathingStatus}`)
			src.pathingStatus = ref.pathingStatus
			con.pathingStatus = ref.pathingStatus
			pathLoc(src)
		}
	}

	indent = indent.slice(2)
	return loc.pathingStatus
}

function hasValidFactors(con, loc, ref) {
	if (con.length === 0) return true
	for (let i = 0; i < con.length; i++) {
		let factors = con[i]
		if (items.evaluateAnd(factors, `factors of ${loc.basename} -> ${ref.basename}`)) {
			trace(_ => indent + "  valid factors.")
			return true
		}
	}
	return false
}
