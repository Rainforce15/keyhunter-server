import {elements, getFactored, hasDefinedConnections} from "./maps.js";
import {extracted} from "./packLoader.js";
import * as items from "./items.js";

const pathValues = {"-1":"unreachable", 0:"unknown", 1:"reachable", 2:"oneway trip"}

export function showEverything(value) {
	if (value === undefined) {
		return _showEverything
	} else {
		_showEverything = value
	}
}

let _showEverything = false

export function generateImageForMap(map) {
	let mapDiv = document.createElement("div")
	mapDiv.setAttribute("style", "position: relative; display: inline-block; overflow: hidden")
	mapDiv.setAttribute("class", "__mapFrame")

	for (let locName in map) {
		let locData = map[locName]
		if (locData === undefined) continue
		if (locData["connectsTo"] || locData["connectsOneWayTo"]) {
			generateLineData(locData, "connectsTo", mapDiv)
			generateLineData(locData, "connectsOneWayTo", mapDiv)
		}
		if (locData["img"]) {
			let locElement = document.createElement("img")
			locElement.setAttribute("class", `map_location map_img_${map.rendername}__${locData.rendername}`)
			locData.conDesc = ""
			if (locData["connectsTo"]) locData.conDesc += "connects to:\n    " + generateConDesc(locData, "connectsTo") + "\n"
			if (locData["connectsOneWayTo"]) locData.conDesc += "connects oneway to:\n    " + generateConDesc(locData, "connectsOneWayTo") + "\n"
			if (locData["connectsOneWayFrom"]) locData.conDesc += "connects oneway from:\n    " + generateConDesc(locData, "connectsOneWayFrom")

			setDataForMapLoc(locData, locElement)
			if (!locData.domRefs) {
				console.log("no domRefs?", locData)
				throw "here."
			}
			locData.domRefs.push(locElement)
			mapDiv.appendChild(locElement)
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

export function updateAllMapRender() {
	for (let mapName in elements) {
		updateMapRender(elements[mapName])
	}
}

function updateMapRender(map) {
	for (let locName in map) {
		let locData = map[locName]
		if (locData === undefined) continue
		let locImgs = locData.domRefs
		for (let locImg of locImgs) {
			setDataForMapLoc(locData, locImg)
		}
	}
}

function getStyleXYWHV(obj) {
	let style = ""
	if (obj.x !== undefined || obj.y !== undefined) style+="position: absolute;"
	if (obj.x !== undefined) style += `left:${getFactored(obj, "x")}px;`
	if (obj.y !== undefined) style += `top:${getFactored(obj, "y")}px;`
	if (obj.width !== undefined) style += `width:${obj.width}px;`
	if (obj.height !== undefined) style += `height:${obj.height}px;`
	style += getStyleVisibility(obj)
	return style
}

function getStyleVisibility(obj) {
	if (obj.visible === true) return ""
	if (obj.visible && !items.evaluateAnd(obj.visible, obj.basename)) return "visibility: hidden;"

	if (!hasDefinedConnections(obj)) return ""

	let doNotRender = obj.pathingStatus < 1 || !obj.itemsLeft
	if (!_showEverything && doNotRender) return "visibility: hidden;"

	return ""
}

function getSuitableImg(locData) {
	let partDataImgStage = locData["imgStage"]
	let partDataImg = locData["img"]
	if (partDataImgStage) return partDataImg[items.elements[partDataImgStage].curStage]
	return locData["img"]
}


function setDataForMapLoc(locData, img) {
	let style = "image-rendering:crisp-edges;"
	style += getStyleXYWHV(locData)
	if (locData["layer"]) style += `z-index:${locData["layer"]};`

	let imgData = undefined
	if (locData.pathingStatus === -1) {
		imgData = locData["imgOff"] || getSuitableImg(locData)
		if (!locData["imgOff"] && !locData.visible === true) style += "filter: grayscale(66%);"
	}else if (locData.pathingStatus === 1 && !locData.itemsLeft) {
		imgData = getSuitableImg(locData)
		style += "filter: grayscale(100%);"
	} else if (locData.pathingStatus > 0) {
		imgData = getSuitableImg(locData)
	}

	if (imgData) img.setAttribute("src", extracted[`img/${imgData}`])
	else img.setAttribute("src", "/img/imgerror.png")

	if (hasDefinedConnections(locData)) img.setAttribute(
		"title",
		`${locData.basename} (${pathValues[locData.pathingStatus]}${locData.items ? ", " + locData.itemsLeft + "/" + locData.items.length + " items left" : ""})\n${locData.conDesc}`
	)
	img.setAttribute("style", style)
}