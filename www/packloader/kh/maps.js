import * as base from "./base.js";
import * as util from "./util.js";
import * as pathing from "./pathing.js";
import * as items from "./items.js";

export let elements
let _showEverything = false
let extracted
const pathValues = {"-1":"unreachable", 0:"unknown", 1:"reachable", 2:"oneway trip"}

export function showEverything(value) {
	if (value === undefined) {
		return _showEverything
	} else {
		_showEverything = value
	}
}

export function load(extractedFiles) {
	extracted = extractedFiles
	elements = extracted["maps.yaml"] || extracted["maps.json"]
	console.log("loading maps...")
	console.log(elements)
	base.applyBaseRendername(elements)
	for (let mapName in elements) {
		let map = elements[mapName]
		let mapParts = map["parts"]
		if (mapParts) {
			base.applyTemplates(mapParts, elements["__templates"]["parts"])
			base.applyBaseRendername(mapParts)
			for (let partName in mapParts) {
				mapParts[partName].parentMapName = map.basename
				mapParts[partName].domRefs = []
				extractXYWH(mapParts[partName])

			}
		}
		let mapLocations = map["locations"]
		if (mapLocations) {
			base.applyTemplates(mapLocations, elements["__templates"]["locations"])
			base.applyBaseRendername(mapLocations)
			for (let locName in mapLocations) {
				let locData = mapLocations[locName]
				if (locData === undefined) {
					console.error("Empty Location:", locName)
					continue
				}
				locData.parentMapName = map.basename
				extractXYWH(locData)
				if (locData.item && !locData.items) locData.items = locData.item
				if (locData.items) {
					if (typeof locData.items === "string") locData.items = [locData.items]
					for (let i = 0; i < locData.items.length; i++) {
						if (locData.items[i] === "@" && locName.substring(0, 2) !== "__") locData.items[i] = locName
					}
					locData.itemsLeft = locData.items.length

				} else {
					locData.itemsLeft = 0
				}
				locData.domRefs = []
				locData.lineDomRefs = {}
				fixAndLinkBackAndForth(locData, "connectsTo", map)
				fixAndLinkBackAndForth(locData, "connectsOneWayTo", map, "connectsOneWayFrom")
				fixAndLinkBackAndForth(locData, "connectsOneWayFrom", map, "connectsOneWayTo")
			}
		}
	}

	pathing.checkPaths(elements)
	pathing.pathMaps(elements)
	let lostLocs = []
	for (let mapName in elements) {
		let map = elements[mapName]
		let mapLocations = map["locations"]
		if (mapLocations) {
			for (let locName in mapLocations) {
				let locData = mapLocations[locName]
				if (locData === undefined) continue
				if (!locData.connectedToEntryPoint) {
					lostLocs.push(`${mapName}::${locName}`)
				}
			}
		}
	}
	if (lostLocs.filter(e=>e.substring(0, 2) !== "__").length > 0) console.warn(`unconnected location(s): ${lostLocs.filter(e => e.substring(0, 2) !== "__").join(", ")}`)

	console.log(elements)
	console.log("done")
}

function fixAndLinkBackAndForth(loc, attribute, map, backAttribute) {
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
		if (connectionMap["locations"][connectionLoc]) {
			let target = connectionMap["locations"][connectionLoc]
			connectionData.ref = target
			let locName;
			if (connectionMap !== map) {
				locName = `${map.basename}::${loc.basename}`
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
		let mapLocations = map["locations"]
		if (mapLocations) {
			for (let locName in mapLocations) {
				let locData = mapLocations[locName]
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

}

export function updateAllMapRender() {
	for (let mapName in elements) {
		updateMapRender(elements[mapName])
	}
}

function updateMapRender(map) {
	let mapParts = map["parts"]
	if (mapParts) {
		for (let partName in mapParts) {
			let part = mapParts[partName]
			let mapImgs = part.domRefs
			util.log(mapImgs)
			for(let i = 0; i < mapImgs.length; i++) {
				setDataForMapPart(part, mapImgs[i])
			}
		}
	}
	let mapLocations = map["locations"]
	if (mapLocations) {
		for (let locName in mapLocations) {
			let locData = mapLocations[locName]
			if (locData === undefined) continue
			let locImgs = locData.domRefs
			for (let locImg of locImgs) {
				setDataForMapLoc(locData, locImg)
			}
		}
	}
}

export function generateImageForMap(map) {
	let mapDiv = document.createElement("div")
	mapDiv.setAttribute("style", "position: relative; display: inline-block; overflow: hidden")
	mapDiv.setAttribute("class", "__mapFrame")
	let mapParts = map["parts"]
	if (mapParts) {
		for (let mapPart in mapParts) {
			let partData = mapParts[mapPart]
			if (partData.top) continue
			let mapImgElement = document.createElement("img")
			mapImgElement.setAttribute("class", `map_img_${map.rendername}__${partData.rendername}`)
			setDataForMapPart(partData, mapImgElement)
			partData.domRefs.push(mapImgElement)
			mapDiv.appendChild(mapImgElement)
		}
	}

	let mapLocations = map["locations"]
	if (mapLocations) {
		for (let locName in mapLocations) {
			let locData = mapLocations[locName]
			if (locData === undefined) continue
			if (locData["connectsTo"]) {
				console.log(locName, locData)
				generateLineData(locData, "connectsTo", mapDiv)
				generateLineData(locData, "connectsOneWayTo", mapDiv)
			}
			if (locData["img"]) {
				let locElement = document.createElement("img")
				locElement.setAttribute("class", `map_location map_img_${map.rendername}__${locData.rendername}`)
				locData.conDesc =  (locData["connectsTo"]?"connects to:\n    "+generateConDesc(locData, "connectsTo")+"\n":"")+
					(locData["connectsOneWayTo"]?"connects oneway to:\n    " + generateConDesc(locData, "connectsOneWayTo")+"\n":"") +
					(locData["connectsOneWayFrom"]?"connects oneway from:\n    " + generateConDesc(locData, "connectsOneWayFrom"):"")

				setDataForMapLoc(locData, locElement)
				locData.domRefs.push(locElement)
				mapDiv.appendChild(locElement)
			}
		}
	}

	if (mapParts) {
		for (let mapPart in mapParts) {
			let partData = mapParts[mapPart]
			if (!partData.top) continue
			let mapImgElement = document.createElement("img")
			mapImgElement.setAttribute("class", `map_img_${map.rendername}__${partData.rendername}`)
			setDataForMapPart(partData, mapImgElement)
			partData.domRefs.push(mapImgElement)
			mapDiv.appendChild(mapImgElement)
		}
	}
	return mapDiv
}

function generateConDesc(locData, attribute) {
	return Object.keys(locData[attribute])
		.map(e => e + (
			locData[attribute][e].length>0?
				` -- ${JSON.stringify(locData[attribute][e])}`:
				""
		)).join("\n    ")
}

function generateLineData(locData, connectionAttribute, parent) {
	let locName = locData.basename
	if (!locData.hasLine) locData.hasLine = {}
	for (let conName in locData[connectionAttribute]) {
		let conRef = locData[connectionAttribute][conName] && locData[connectionAttribute][conName].ref
		if (conRef === undefined) console.warn("no ref?", locData.basename, connectionAttribute, conName)
		let nameOrder = [locData.rendername, conRef.rendername].sort()
		let connectionClassName = `map_line_${nameOrder[0]}__${nameOrder[1]}`
		if (conRef && !conRef.hasLine) conRef.hasLine = {}
		if (conRef && conName.indexOf("::") === -1 && !conRef.hasLine[locName]) {
			let lineDiv = createLine(
				getFactored(locData, "x") + (locData.width?locData.width/2:0),
				getFactored(locData, "y") + (locData.height?locData.height/2:0),
				getFactored(conRef, "x") + (conRef.width?conRef.width/2:0),
				getFactored(conRef, "y") + (conRef.width?conRef.width/2:0),
				connectionClassName
			)
			let titleString = `${locData.basename} -- ${conRef.basename}\n`
			titleString += locData[connectionAttribute][conName].map(e=>JSON.stringify(e)).join("\n")
			lineDiv.setAttribute("title", titleString)
			parent.appendChild(lineDiv)
			locData.hasLine[conName] = 1
			conRef.hasLine[locName] = 1
			if (!locData.lineDomRefs[connectionClassName]) locData.lineDomRefs[connectionClassName] = []
			if (!conRef.lineDomRefs[connectionClassName]) conRef.lineDomRefs[connectionClassName] = []
			locData.lineDomRefs[connectionClassName].push(lineDiv)
			conRef.lineDomRefs[connectionClassName].push(lineDiv)
		}
	}
}

function createLine(x, y, x2, y2, classString) {
	let baseStyle = "position:absolute;background:black;height:2px;"
	let lineDiv = document.createElement("div")
	let xDiff = x2 - x
	let yDiff = y2 - y
	let len = Math.sqrt(Math.pow(xDiff, 2) + Math.pow(yDiff, 2))
	let angle = Math.atan2(yDiff, xDiff) / Math.PI * 180
	let renderX = x + xDiff/2 - len/2;
	let renderY = y - 1 + yDiff/2
	lineDiv.setAttribute("style", `${baseStyle}width:${len}px;left:${renderX}px;top:${renderY}px;transform:rotate(${angle}deg);`)
	lineDiv.setAttribute("class", `map_line ${classString}`)
	return lineDiv
}

function setDataForMapLoc(locData, img) {
	let style = "image-rendering:crisp-edges;"
	style += getStyleXYWHV(locData)
	if (locData.pathingStatus === -1) {
		let imgData = locData["imgOff"] || locData["img"]
		if (imgData) img.setAttribute("src", extracted[`img/${imgData}`])
		else img.setAttribute("src", "/img/imgerror.png")
		if (!locData["imgOff"]) style += "filter: grayscale(66%);"
	}else if (locData.pathingStatus === 1 && !locData.itemsLeft) {
		let imgData = locData["img"]
		if (imgData) img.setAttribute("src", extracted[`img/${imgData}`])
		else img.setAttribute("src", "/img/imgerror.png")
		style += "filter: grayscale(100%);"
	} else if (locData.pathingStatus > 0) {
		let imgData = locData["img"]
		if (imgData) img.setAttribute("src", extracted[`img/${imgData}`])
		else img.setAttribute("src", "/img/imgerror.png")
	}
	if (!_showEverything && (locData.pathingStatus < 1 || !locData.itemsLeft)) style += "visibility: hidden;"
	img.setAttribute(
		"title",
		`${locData.basename} (${pathValues[locData.pathingStatus]}${locData.items ? ", " + locData.itemsLeft + "/" + locData.items.length + " items left" : ""})\n${locData.conDesc}`
	)
	img.setAttribute("style", style)
}

function setDataForMapPart(partData, img) {
	let partDataImgStage = partData["imgStage"]
	let partDataImg = partData["img"]
	if (partDataImgStage) img.setAttribute("src", extracted[`img/${partDataImg[items.elements[partDataImgStage].curStage]}`])
	else img.setAttribute("src", extracted[`img/${partDataImg}`])
	let style = "image-rendering:crisp-edges;"
	style += getStyleXYWHV(partData)
	img.setAttribute("style", style)
}

function getStyleXYWHV(obj) {
	let style = ""
	if (obj.x !== undefined || obj.y !== undefined) style+="position: absolute;"
	if (obj.x !== undefined) style += `left:${getFactored(obj, "x")}px;`
	if (obj.y !== undefined) style += `top:${getFactored(obj, "y")}px;`
	if (obj.width !== undefined) style += `width:${obj.width}px;`
	if (obj.height !== undefined) style += `height:${obj.height}px;`
	if (obj.visible && !items.evaluateAnd(obj.visible, obj.basename)) style += "visibility: hidden;"
	return style
}

function getFactored(obj, xy) {
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

