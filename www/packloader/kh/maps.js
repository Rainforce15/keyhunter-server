import {extracted} from "./packLoader.js";
import * as base from "./base.js";
import * as pathing from "./pathing.js";
import * as items from "./items.js";
import {pathMaps} from "./pathing.js";

export let elements

export function init() {
	elements = extracted["maps.yaml"] || extracted["maps.json"]
	console.log("loading maps...")
	console.log(elements)
	for (let mapName in elements) {
		let map = elements[mapName]
		base.applyBaseRendername(map)
		base.applyTemplates(map, elements[".templates"])
	}
	for (let mapName in elements) {
		let map = elements[mapName]
		for (let locName in map) {
			let locData = map[locName]
			if (locData === undefined) {
				console.error("Empty Location:", locName)
				continue
			}
			locData.parentMapName = mapName
			extractXYWH(locData)
			if (locData.item && !locData.items) locData.items = locData.item
			if (locData.items) {
				if (typeof locData.items === "string") locData.items = [locData.items]
				for (let i = 0; i < locData.items.length; i++) {
					if (locData.items[i] === "@" && !locName.startsWith(".")) locData.items[i] = locName
				}
				locData.itemsLeft = locData.items.length

			} else {
				locData.itemsLeft = 0
			}
			locData.domRefs = []
			locData.lineDomRefs = {}
			locData.entryPoint = fixUpReq(locData.entryPoint)
			fixAndLinkBackAndForth(locData, "connectsTo", map, mapName)
			fixAndLinkBackAndForth(locData, "connectsOneWayTo", map, mapName, "connectsOneWayFrom")
			fixAndLinkBackAndForth(locData, "connectsOneWayFrom", map, mapName, "connectsOneWayTo")
		}
	}
	for (let mapName in elements) {
		let map = elements[mapName]
		for (let locName in map) {
			let locData = map[locName]
			if (hasCrossMapConnections(locData)) locData.hasCrossMapConnections = true
		}
	}

	setupEntryPaths(elements)
	// pathing.pathMaps(elements)
	let lostLocs = []
	for (let mapName in elements) {
		let map = elements[mapName]
		for (let locName in map) {
			let locData = map[locName]
			if (locData === undefined) continue
			if (!locData.connectedToEntryPoint && hasDefinedConnections(locData)) {
				lostLocs.push(`${mapName}::${locName}`)
			}
		}
	}
	if (lostLocs.length > 0) console.warn(`unconnected location(s): ${lostLocs.join(", ")}`)

	console.log(elements)
	console.log("maps done")

	return elements
}

function hasCrossMapConnections(locData) {
	for (let conName in locData["connectsTo"]) {
		if (conName.indexOf("::") !== -1) return true
	}
	for (let conName in locData["connectsOneWayTo"]) {
		if (conName.indexOf("::") !== -1) return true
	}
	for (let conName in locData["connectsOneWayFrom"]) {
		if (conName.indexOf("::") !== -1) return true
	}
	return false;
}

function fixAndLinkBackAndForth(loc, connectionType, map, mapName, backAttribute) {
	loc.parentMap = map
	if (!loc[connectionType]) return
	if (!backAttribute) backAttribute = connectionType
	if (typeof loc[connectionType] === "string") {
		let oriConnection = loc[connectionType]
		loc[connectionType] = {}
		loc[connectionType][oriConnection] = []
	}
	let connectionSet = loc[connectionType]
	for (let connectionName in connectionSet) {
		connectionSet[connectionName] = fixUpReq(connectionSet[connectionName])
		let connection = connectionSet[connectionName]
		if (connection.ref && connection.src) continue // we already did this
		connection.connectionType = connectionType
		let target = getLocByName(connectionName, map)

		if (target) {
			connection.ref = target
			connection.src = loc

			let locName;
			if (target.parentMap !== map) {
				locName = `${mapName}::${loc.basename}`
			} else {
				locName = loc.basename
			}

			if (!target[backAttribute]) target[backAttribute] = {}
			let backConnectionSet = target[backAttribute]
			let backConnection = backConnectionSet[locName]
			if (backConnection === connection) continue // we already did this

			backConnection = fixUpReq(backConnection)

			for (let requirement of backConnection) {
				connection.push(requirement)
			}

			backConnectionSet[locName] = connection
		}
	}
}

function getLocByName(name, defaultMap) {
	let locNameParts = name.split(/::/)
	if (locNameParts.length > 2) console.warn(`couldn't parse loc reference: ${name}`)

	let locMap
	let locName
	if (locNameParts.length > 1) {
		locMap = elements[locNameParts[0]]
		locName = locNameParts[1]
	} else {
		locMap = defaultMap
		locName = locNameParts[0]
	}
	if (!locMap) console.warn(`could not find map for ${name}`)
	if (!locName) console.warn(`could not find location for ${name}`)
	let loc = locMap[locName]
	if (!loc.parentMap) loc.parentMap = locMap
	return loc
}

function fixUpReq(val) {
	if (val === null || val === undefined) {
		return []
	}
	if (typeof val === "string") {
		return [[val]]
	}
	else if (typeof val === "object" && !Array.isArray(val)) {
		return [val]
	}
	else if (Array.isArray(val) && typeof val[0] === "string") {
		return [val]
	} else {
		return val
	}
}

function extractXYWH(obj) {
	let objWh = obj["wh"]
	if (objWh !== undefined) {
		if (typeof objWh === "number" || typeof objWh === "string") {
			obj.width = objWh
			obj.height = objWh
		} else if (Array.isArray(objWh) && objWh.length === 2) {
			obj.width = objWh[0]
			obj.height = objWh[1]
		}
	}
	for (let subType of ["", "Factor", "Offset", "2", "2Factor", "2Offset"]) {
		if (typeof obj[`xy${subType}`] === "number" || typeof obj[`xy${subType}`] === "string") {
			obj[`x${subType}`] = obj[`xy${subType}`]
			obj[`y${subType}`] = obj[`xy${subType}`]
		} else if (Array.isArray(obj[`xy${subType}`]) && obj[`xy${subType}`].length === 2) {
			obj[`x${subType}`] = obj[`xy${subType}`][0]
			obj[`y${subType}`] = obj[`xy${subType}`][1]
		}
	}
}

export function updateAllMapData() {
	pathing.pathMaps(elements)

	for (let mapName in elements) {
		let map = elements[mapName]
		for (let locName in map) {
			let locData = map[locName]
			if (locData === undefined) continue
			if (locData.items) {
				let oldItemsLeft = locData.itemsLeft
				locData.itemsLeft = 0
				for (let item of locData.items) {
					if (!items.evaluateEntry(item, undefined, `itemsLeft count of ${locData.basename}`)) locData.itemsLeft++
				}
				if (locData.pathingStatus === -1 && locData.itemsLeft < locData.items.length && oldItemsLeft !== locData.itemsLeft) {
					console.warn ("Out of logic with current items?:", locData.basename, `; items Left from pathing: ${oldItemsLeft}, but actual number is ${locData.itemsLeft}`, locData)
				}
			}
		}
	}
}

export function hasDefinedConnections(locData) {
	return locData["connectsTo"] || locData["connectsOneWayTo"] || locData["connectsOneWayFrom"]
}

export function getFactored(obj, xy) {
	let ret = 0
	let objXY = obj[xy]
	let objXYFactor = obj[xy+"Factor"]
	let objXYOffset = obj[xy+"Offset"]
	let objXY2 = obj[xy+"2"]
	let objXY2Factor = obj[xy+"2Factor"]
	let objXY2Offset = obj[xy+"2Offset"]

	if (typeof objXY === "number") ret =objXY
	if (typeof objXY === "string") ret = items.elements[objXY].curStage || 0
	if (objXYFactor) ret *= objXYFactor
	if (objXYOffset) ret += objXYOffset

	if (objXY2 || objXY2Offset) {
		let ret2 = 0
		if (objXY2) {
			if (typeof objXY2 === "number") ret2 = objXY2
			if (typeof objXY2 === "string") ret2 = items.elements[objXY2].curStage || 0
		}
		if (objXY2Factor) ret2 *= objXY2Factor
		if (objXY2Offset) ret2 += objXY2Offset
		ret += ret2
	}
	return ret
}

function setupEntryPaths(elements) {
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
