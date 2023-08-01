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
	 1: reachable one way
	 2: reachable
 */

export function pathMaps(elements) {
	let entryPoints = []
	//clear pathing
	for (let mapName in elements) {
		let map = elements[mapName]
		for (let locName in map) {
			let loc = map[locName]
			resetPathingStatus(loc)
			if (isEntryPoint(loc)) {
				if (_debug) console.log("valid entry point detected: ", loc.basename)
				loc.pathingStatus = 2
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
			if (_debug) console.log("simple entry point: ", loc.basename)
			return locEntryPoint
		} else {
			if (_debug && locEntryPoint.length > 0) console.log(`entry point ${loc.basename} testing factors: `)
			for (let i = 0; i < locEntryPoint.length; i++) {
				let factors = locEntryPoint[i]
				if (_debug) console.log("    trying", JSON.stringify(factors))
				if (items.evaluateAnd(factors, `entryPoint of ${loc.basename}`)) {
					if (_debug) console.log("      valid factors.")
					return true
				}
			}
		}
	}
	return false
}

function pathLoc(loc) {
	if (_debug) {
		console.log(indent + "pathing: ", loc.basename)
		indent += "  "
	}
	let connectsTo = loc["connectsTo"] || {}
	for (let conName in connectsTo) {
		if (_debug) console.log(indent + "connecting to: ", conName)
		let con = connectsTo[conName]

		let ref;
		if (con.src === loc) ref = con.ref
		else ref = con.src

		if (hasValidFactors(con, loc, ref)) {
			if (ref.pathingStatus > loc.pathingStatus) {
				if (_debug) console.log(indent + `  taking status from higher right hand location (${loc.pathingStatus} -> ${ref.pathingStatus})`)
			} else if (ref.pathingStatus < loc.pathingStatus) {
				if (_debug) console.log(indent + "  going on to right hand location")
				ref.pathingStatus = loc.pathingStatus
				pathLoc(ref)
				if (ref.pathingStatus > loc.pathingStatus) {
					if (_debug) console.log(indent + `  taking status from returned higher right hand location (${loc.pathingStatus} -> ${ref.pathingStatus})`)
				}
			}
			loc.pathingStatus = ref.pathingStatus
			con.pathingStatus = ref.pathingStatus
		}
	}
	let connectsOneWayTo = loc["connectsOneWayTo"] || {}
	for (let conName in connectsOneWayTo) {
		if (_debug) console.log(indent + "connecting oneway to: ", conName)
		let con = connectsOneWayTo[conName]
		let ref = con.ref

		if (hasValidFactors(con, loc, ref)) {
			if (ref.pathingStatus < 2) {
				if (_debug) console.log(indent + "going on to right hand location")
				ref.pathingStatus = 1
				pathLoc(ref)
			} else {
				if (_debug) console.log(indent + "right hand location already pathed and superior")
				loc.pathingStatus = ref.pathingStatus
			}
			con.pathingStatus = ref.pathingStatus
		}
	}

	let connectsOneWayFrom = loc["connectsOneWayFrom"] || {}
	for (let conName in connectsOneWayFrom) {
		if (_debug) console.log(indent + "connecting oneway from: ", conName)
		let con = connectsOneWayFrom[conName]
		let src = con.src
		let ref = loc
		if (src.pathingStatus === 1 && ref.pathingStatus === 2) {
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
			if (_debug) console.log(indent + "  valid factors.")
			return true
		}
	}
	return false
}
