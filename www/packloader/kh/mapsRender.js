import * as util from "./util.js";
import {elements, getFactored} from "./maps.js";
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
	let mapParts = map["parts"]
	if (mapParts) {
		for (let mapPart in mapParts) {
			let partData = mapParts[mapPart]
			let mapImgElement = document.createElement("img")
			mapImgElement.setAttribute("class", `map_img_${map.rendername}__${partData.rendername}`)
			setDataForMapPart(partData, mapImgElement)
			if (!partData.domRefs) {
				console.log("no domRefs?", partData)
				throw "here."
			}
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

function setDataForMapPart(partData, img) {
	let partDataImgStage = partData["imgStage"]
	let partDataImg = partData["img"]
	if (partDataImgStage) img.setAttribute("src", extracted[`img/${partDataImg[items.elements[partDataImgStage].curStage]}`])
	else img.setAttribute("src", extracted[`img/${partDataImg}`])
	let style = "image-rendering:crisp-edges;"
	style += getStyleXYWHV(partData)
	if (partData["layer"]) style += `z-index:${partData["layer"]};`
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


function setDataForMapLoc(locData, img) {
	let style = "image-rendering:crisp-edges;"
	style += getStyleXYWHV(locData)
	if (locData["layer"]) style += `z-index:${locData["layer"]};`
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