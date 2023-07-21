import {extracted} from "./packLoader.js";
import * as base from "./base.js";
import * as pathing from "./pathing.js";
import * as items from "./items.js";

export let elements

export function init() {
	elements = extracted["maps.yaml"] || extracted["maps.json"]
	console.log("loading maps...")
	console.log(elements)
	for (let mapName in elements) {
		let map = elements[mapName]
		base.applyBaseRendername(map)
		base.applyTemplates(map, elements[".templates"])
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
			fixAndLinkBackAndForth(locData, "connectsTo", map, mapName)
			fixAndLinkBackAndForth(locData, "connectsOneWayTo", map, mapName, "connectsOneWayFrom")
			fixAndLinkBackAndForth(locData, "connectsOneWayFrom", map, mapName, "connectsOneWayTo")
		}
	}

	pathing.setupEntryPaths(elements)
	pathing.pathMaps(elements)
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

function fixAndLinkBackAndForth(loc, attribute, map, mapName, backAttribute) {
	if (!loc[attribute]) return
	if (!backAttribute) backAttribute = attribute
	if (typeof loc[attribute] === "string") {
		let oriConnection = loc[attribute]
		loc[attribute] = {}
		loc[attribute][oriConnection] = []
	}
	for (let connectionName in loc[attribute]) {
		let connectionNameParts = connectionName.split(/::/)
		if (connectionNameParts.length > 2) console.warn(`couldn't parse loc reference: ${connectionName}`)
		let connectionMap = connectionNameParts.length > 1?elements[connectionNameParts[0]]:map
		let connectionLoc = connectionNameParts.length > 1?connectionNameParts[1]:connectionNameParts[0]
		if (!connectionMap) console.warn(`could not find map for ${connectionName}`)
		if (!connectionLoc) console.warn(`could not find location for ${connectionName}`)

		loc[attribute][connectionName] = fixUpReq(loc[attribute][connectionName])

		let connectionData = loc[attribute][connectionName]
		if (connectionMap[connectionLoc]) {
			let target = connectionMap[connectionLoc]
			connectionData.ref = target
			let locName;
			if (connectionMap !== map) {
				locName = `${mapName}::${loc.basename}`
			} else {
				locName = loc.basename
			}
			if (!target[backAttribute]) target[backAttribute] = {}
			if (!target[backAttribute][locName]) target[backAttribute][locName] = []
			target[backAttribute][locName] = fixUpReq(target[backAttribute][locName])
			let backConnectionData = target[backAttribute][locName]
			backConnectionData.ref = loc
			for (let requirement of connectionData) {
				if (backConnectionData.indexOf(requirement) === -1) backConnectionData.push(requirement)
			}
		}
	}
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

