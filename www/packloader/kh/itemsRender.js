import {extracted} from "./packLoader.js";
import * as util from "./util.js";
import {elements, adjustStage, getItemName} from "./items.js";

export function generateImageForItem(item) {
	let img = document.createElement("img")
	img.setAttribute("class", `item_img_${item.rendername}`)
	setImgForStage(item, img)
	setItemClickHandler(img, item)
	if (item.imgDomRefs.indexOf(img) === -1) item.imgDomRefs.push(img)
	return img
}
export function generateTitleForItem(item) {
	let title = document.createElement("span")
	title.setAttribute("class", `item_title_${item.rendername}`)
	setTitleForStage(item, title)
	setItemClickHandler(title, item)
	if (item.titleDomRefs.indexOf(title) === -1) item.titleDomRefs.push(title)
	return title
}

function setImgForStage(item, img) {
	let isOff = !item["noOffStage"] && item.curStage === 0
	let imgData
	let imgBaseStyle = /*"border-radius: 50%; "+*/"user-select: none; image-rendering: crisp-edges; vertical-align: middle; "
	if (isOff) {
		imgData = item["imgOff"] || item["img"] || item.stages[0]["img"]
		img.setAttribute("style", imgBaseStyle+/*"border: 2px solid gray; "+*/(item["imgOff"]?"":"filter: grayscale(100%);"))
	} else {
		imgData = item.stages && item.stages[item.curStage - 1]["img"] || item["img"]
		img.setAttribute("style", imgBaseStyle/*+"border: 2px solid lightgray;"*/)
	}

	img.setAttribute("src", extracted["img/"+imgData] || "/img/imgerror.png")
}

function setItemClickHandler(node, item) {
	node.item = item
	let increment = item["increment"] || 1
	node.onclick = CreateClickIncrementor(item, increment)
	node.oncontextmenu = CreateClickIncrementor(item, -increment)
}

function CreateClickIncrementor(item, increment) {
	return function(e) {
		if (e.altKey && e.ctrlKey) adjustStage(item, increment*1000)
		else if (e.altKey) adjustStage(item, increment*100)
		else if (e.ctrlKey) adjustStage(item, increment*10)
		else adjustStage(item, increment)
		e.preventDefault()
		return false
	}
}

export function updateAllItemRender() {
	for (let itemName in elements) {
		if (elements[itemName].delayUpdate) {
			elements[itemName].delayUpdate = false
			return
		}
		updateItemRender(elements[itemName])
	}
}

export function updateItemRender(item) {
	let itemImgs = item.imgDomRefs
	util.log(itemImgs)
	for(let itemImg of itemImgs) {
		setImgForStage(item, itemImg)
	}
	let itemTitles = item.titleDomRefs
	util.log(itemTitles)
	for(let itemTitle of itemTitles) {
		setTitleForStage(item, itemTitle)
	}
}

function setTitleForStage(item, title) {
	let isOff = !item["noOffStage"] && item.curStage === 0
	title.setAttribute("style", `user-select: none; color: ${isOff ? "gray" : "lightgray"}`)
	title.innerHTML = getItemName(item)
}