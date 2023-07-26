import {elements, getFactored, hasDefinedConnections} from "./maps.js";
import {extracted} from "./packLoader.js";
import * as items from "./items.js";

const pathValues = {0: "unreachable", 1: "reachable", 2: "oneway trip"}

let _showAllLocations = false
let _showAccessInMesh = false

const colors = {
	noAccess: "#777",
	access: "#FFF",
	accessWithItems: "#F3A",
	accessOneWay: "#0AF",
	bg: "#000"
}

const bgNoAccess = `background:${colors.noAccess};z-index:2;`
const bgAccess = `background:${colors.access};`
const bgAccessWithItems = `background:${colors.accessWithItems};`
const bgAccessOneWay = `background:${colors.accessOneWay};`
const bgBg = `background:${colors.bg};`

const borderNoAccess = `border: 2px solid ${colors.noAccess};background:${colors.bg};z-index:2;`
const borderAccess = `border: 2px solid ${colors.access};background:${colors.bg};`
const borderAccessWithItems = `border: 2px solid ${colors.accessWithItems};background:${colors.bg};`
const borderAccessOneWay = `border: 2px solid ${colors.accessOneWay};background:${colors.bg};`

export function showAllLocations(value) {
	if (value === undefined) return _showAllLocations
	else _showAllLocations = value
}

export function showAccessInMesh(value) {
	if (value === undefined) return _showAccessInMesh
	else _showAccessInMesh = value
}

export function generateImageForMap(map, mapName) {
	let mapDiv = document.createElement("div")
	mapDiv.setAttribute("style", "position:relative;display:inline-block;overflow:hidden")
	mapDiv.setAttribute("class", "__mapFrame")

	for (let locName in map) {
		let locData = map[locName]
		if (locData === undefined) continue

		locData.conDesc = ""
		if (locData["connectsTo"]) locData.conDesc += "connects to:\n    " + generateConDesc(locData, "connectsTo") + "\n"
		if (locData["connectsOneWayTo"]) locData.conDesc += "connects oneway to:\n    " + generateConDesc(locData, "connectsOneWayTo") + "\n"
		if (locData["connectsOneWayFrom"]) locData.conDesc += "connects oneway from:\n    " + generateConDesc(locData, "connectsOneWayFrom")

		if (locData["connectsTo"] || locData["connectsOneWayTo"]) {
			generateLineData(locData, "connectsTo", mapDiv)
			generateLineData(locData, "connectsOneWayTo", mapDiv)
			generatePointData(locData, mapDiv, mapName)
		}
		if (locData["img"]) {
			let locElement = document.createElement("img")
			if (hasDefinedConnections(locData)) locElement.setAttribute("class", `map_location map_img_${mapName}__${locData.rendername}`)
			else locElement.setAttribute("class", `map_img_${mapName}__${locData.rendername}`)

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

function generateLineData(locData, connectionType, parent) {
	let locName = locData.basename
	if (!locData.hasLine) locData.hasLine = {}
	for (let conName in locData[connectionType]) {
		let connection = locData[connectionType][conName]
		let conRef = connection?.ref
		if (conRef === undefined) console.warn("no ref?", locData.basename, connectionType, conName)
		let nameOrder = [locData.rendername, conRef.rendername].sort()
		let connectionClassName = `map_line_${nameOrder[0]}__${nameOrder[1]}`
		if (conRef && !conRef.hasLine) conRef.hasLine = {}
		if (conRef && conName.indexOf("::") === -1 && !conRef.hasLine[locName]) {

			let x = getFactored(locData, "x") + (locData.width?locData.width/2:0)
			let y = getFactored(locData, "y") + (locData.height?locData.height/2:0)
			let x2 = getFactored(conRef, "x") + (conRef.width?conRef.width/2:0)
			let y2 = getFactored(conRef, "y") + (conRef.width?conRef.width/2:0)

			let titleString = `${locData.basename} -- ${conRef.basename}\n`
			titleString += connection.map(e=>JSON.stringify(e)).join("\n")

			let lineDivBG = createLine(x, y, x2, y2, connectionClassName, bgBg + "height:4px;z-index:1;")
			lineDivBG.setAttribute("title", titleString)
			parent.appendChild(lineDivBG)
			let lineDiv = createLine(x, y, x2, y2, connectionClassName, bgAccess + "height:2px;z-index:3;")
			lineDiv.setAttribute("title", titleString)
			lineDiv.bg = lineDivBG
			parent.appendChild(lineDiv)

			locData.hasLine[conName] = 1
			conRef.hasLine[locName] = 1
			if (!locData.lineDomRefs[connectionClassName]) locData.lineDomRefs[connectionClassName] = []
			if (!conRef.lineDomRefs[connectionClassName]) conRef.lineDomRefs[connectionClassName] = []
			if (!connection.lineDomRefs) connection.lineDomRefs = []
			locData.lineDomRefs[connectionClassName].push(lineDiv)
			conRef.lineDomRefs[connectionClassName].push(lineDiv)
			connection.lineDomRefs.push(lineDiv)
		}
	}
}

function getLocnameAccessItemsLeft(locData) {
	return `${locData.basename} (${pathValues[locData.pathingStatus]}${locData.items ? ", " + locData.itemsLeft + "/" + locData.items.length + " items left" : ""})`
}

function generatePointData(locData, parent, mapName) {
	if (locData.x === undefined && locData.y === undefined) return
	let style = "border-radius:50%;transform:translate(-50%,-50%);z-index:4;position:absolute;"
	if (locData.x !== undefined) style += `left:${getFactored(locData, "x") + locData.width / 2}px;`
	if (locData.y !== undefined) style += `top:${getFactored(locData, "y") + locData.height / 2}px;`

	let classString = `map_point_${mapName}__${locData.rendername}`
	let itemList = locData.items ? `\nitems:\n    ` + locData.items.join("\n    ") : ""
	let title = `${getLocnameAccessItemsLeft(locData)}${itemList}\n${locData.conDesc}`
	let htmlClass = `map_line ${classString}`

	let pointDivBG = document.createElement("div")
	pointDivBG.setAttribute("title", title)

	let bgStyleData
	if (locData.hasCrossMapConnections) bgStyleData = `${style}${bgBg}width:9px;height:9px;z-index:1;`
	else bgStyleData = `${style}${bgBg}width:8px;height:8px;z-index:1;`

	pointDivBG.setAttribute("style", bgStyleData)
	pointDivBG.setAttribute("class", htmlClass)
	pointDivBG.styleData = bgStyleData
	parent.appendChild(pointDivBG)

	let pointDiv = document.createElement("div")
	pointDiv.setAttribute("title", title)

	let styleData
	if (locData.hasCrossMapConnections) styleData = `${style}${borderAccess}width:3px;height:3px;`
	else styleData = `${style}${bgAccess}width:6px;height:6px;`

	pointDiv.setAttribute("style", styleData)
	pointDiv.setAttribute("class", htmlClass)
	pointDiv.styleData = styleData
	pointDiv.bg = pointDivBG
	parent.appendChild(pointDiv)
	if(!locData.pointDomRef) locData.pointDomRef = pointDiv
}

function createLine(x, y, x2, y2, classString, styleString) {
	let baseStyle = `position:absolute;${styleString}`
	let lineDiv = document.createElement("div")
	let xDiff = x2 - x
	let yDiff = y2 - y
	let len = Math.sqrt(Math.pow(xDiff, 2) + Math.pow(yDiff, 2))
	let angle = Math.atan2(yDiff, xDiff) / Math.PI * 180
	let renderX = x + xDiff/2 - len/2;
	let renderY = y + yDiff/2
	let styleData = `${baseStyle}width:${len}px;left:${renderX}px;top:${renderY}px;transform:translateY(-50%) rotate(${angle}deg);`
	lineDiv.setAttribute("style", styleData)
	lineDiv.styleData = styleData
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
		map[locName].linesSet = false
	}
	for (let locName in map) {
		let locData = map[locName]
		if (locData === undefined) continue
		setMeshForMapLoc(locData)
		let locImgs = locData.domRefs
		for (let locImg of locImgs) {
			setDataForMapLoc(locData, locImg)
		}
	}
}

function getStyleXYWH(obj) {
	let style = ""
	if (obj.x !== undefined || obj.y !== undefined) style+="position:absolute;"
	else style+="position:relative;"
	if (obj.x !== undefined) style += `left:${getFactored(obj, "x")}px;`
	if (obj.y !== undefined) style += `top:${getFactored(obj, "y")}px;`
	if (obj.width !== undefined) style += `width:${obj.width}px;`
	if (obj.height !== undefined) style += `height:${obj.height}px;`
	return style
}

function getStyleVisibility(obj) {
	if (obj.visible === true) return ""
	if (obj.visible && !items.evaluateAnd(obj.visible, obj.basename)) return "visibility:hidden;"
	return ""
}

function getStyleVisibilityIncludingAccess(obj) {
	if (obj.visible === true) return ""
	if (obj.visible && !items.evaluateAnd(obj.visible, obj.basename)) return "visibility:hidden;"

	if (!hasDefinedConnections(obj)) return ""

	let doNotRender = obj.pathingStatus < 1 || !obj.itemsLeft
	if (!_showAllLocations && doNotRender) return "visibility:hidden;"

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
	style += getStyleXYWH(locData)
	style += getStyleVisibilityIncludingAccess(locData)
	let hasConnections = hasDefinedConnections(locData)

	if (locData["layer"]) style += `z-index:${locData["layer"]};`
	else if (hasConnections) style += `z-index:1000;`

	let imgData = undefined
	if (locData.pathingStatus === 0) {
		imgData = locData["imgOff"] || getSuitableImg(locData)
		if (!locData["imgOff"] && !locData.visible === true) style += "filter:grayscale(66%);"
	}else if (locData.pathingStatus === 1 && !locData.itemsLeft) {
		imgData = getSuitableImg(locData)
		style += "filter:grayscale(100%);"
	} else if (locData.pathingStatus > 0) {
		imgData = getSuitableImg(locData)
	}

	if (imgData) img.setAttribute("src", extracted[`img/${imgData}`])
	else img.setAttribute("src", "/img/imgerror.png")

	if (hasConnections) img.setAttribute(
		"title",
		`${getLocnameAccessItemsLeft(locData)}\n${locData.conDesc}`
	)
	img.setAttribute("style", style)
}

function setLineStyleForMapLoc(locData, connectionType) {
	for (let conName in locData[connectionType]) {
		let con = locData[connectionType][conName]
		if (!con.lineDomRefs) continue
		let styleAdditions = ""
		let vis = ""
		if (_showAccessInMesh) {
			if (con.pathingStatus === 0) styleAdditions = bgNoAccess
			else if (con.pathingStatus === 1) styleAdditions = bgAccess
			else if (con.pathingStatus === 2) styleAdditions = bgAccessOneWay
			vis = getStyleVisibility(locData) || getStyleVisibility(con.ref)
		}
		for (let lineDom of con.lineDomRefs) {
			lineDom.setAttribute("style", `${lineDom.styleData}${styleAdditions}${vis}`)
			lineDom.bg.setAttribute("style", `${lineDom.bg.styleData}${vis}`)
		}
	}
}

function setMeshForMapLoc(locData) {
	if (locData.pointDomRef) {
		let styleAdditions = ""
		let vis = ""
		let pointDom = locData.pointDomRef
		if (_showAccessInMesh) {
			if (locData.pathingStatus === 0) styleAdditions = locData.hasCrossMapConnections ? borderNoAccess : bgNoAccess
			else if (locData.pathingStatus === 1) {
				if (locData.itemsLeft) styleAdditions = locData.hasCrossMapConnections ? borderAccessWithItems : bgAccessWithItems
				else styleAdditions = locData.hasCrossMapConnections ? borderAccess : bgAccess
			} else if (locData.pathingStatus === 2) {
				if (locData.itemsLeft) styleAdditions = locData.hasCrossMapConnections ? borderAccessWithItems : bgAccessWithItems
				else styleAdditions = locData.hasCrossMapConnections ? borderAccessOneWay : bgAccessOneWay
			}
			vis = getStyleVisibility(locData)
		}
		pointDom.setAttribute("style", `${pointDom.styleData}${styleAdditions}${vis}`)
		pointDom.bg.setAttribute("style", `${pointDom.bg.styleData}${vis}`)

		let itemList = locData.items ? `\nitems:\n    ` + locData.items.join("\n    ") : ""
		let title = `${getLocnameAccessItemsLeft(locData)}${itemList}\n${locData.conDesc}`
		pointDom.setAttribute("title", title)
		pointDom.bg.setAttribute("title", title)

		setLineStyleForMapLoc(locData, "connectsTo")
		setLineStyleForMapLoc(locData, "connectsOneWayTo")
		setLineStyleForMapLoc(locData, "connectsOneWayFrom")
	}

	let alreadyCovered = {}
	for (let conName in locData["connectsTo"]) {
		let con = locData["connectsTo"][conName]
		if (con.ref.linesSet) continue
		alreadyCovered[con.ref.basename] = true
	}
	for (let conName in locData["connectsOneWayTo"]) {
		let con = locData["connectsOneWayTo"][conName]
		if (con.ref.linesSet || alreadyCovered[con.ref.basename]) continue
		alreadyCovered[con.ref.basename] = true
	}
	for (let conName in locData["connectsOneWayFrom"]) {
		let con = locData["connectsOneWayFrom"][conName]
		if (con.ref.linesSet || alreadyCovered[con.ref.basename]) continue
		alreadyCovered[con.ref.basename] = true
	}
	locData.linesSet = true
}