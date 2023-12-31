import {extracted} from "./packLoader.js";
import * as items from "./items.js"
import * as itemsRender from "/packloader/kh/itemsRender.js"
import * as maps from "./maps.js"
import * as mapsRender from "./mapsRender.js"

export function testItems(t) {
	console.log("testing items...")
	setTimeout(() => {
		let testDiv = document.createElement("div")
		addTestHeader("Item Test", testDiv, document.body)
		let itemGroups = {}
		for (let itemName in items.elements) {
			if (itemName.startsWith(".")) continue
			let item = items.elements[itemName]
			let groupName = item.template?.[item.template.length-1] || (item.basename.startsWith(".") ? ".hidden" : "(no template)")
			if (!itemGroups[groupName]) itemGroups[groupName] = []
			itemGroups[groupName].push(item)
		}
		for (let group in itemGroups) {
			let groupDiv = document.createElement("div")
			groupDiv.setAttribute("style", "display: inline-block; vertical-align: top; margin: 8px;")
			let h2 = document.createElement("h2")
			h2.appendChild(document.createTextNode(group))
			groupDiv.appendChild(h2)

			for (let item of itemGroups[group]) {
				if (item["img"] || item.stages && item.stages[0]["img"]) {
					groupDiv.appendChild(itemsRender.generateImageForItem(item))
					groupDiv.appendChild(document.createTextNode(" "))
				}
				groupDiv.appendChild(itemsRender.generateTitleForItem(item))
				groupDiv.appendChild(document.createElement("br"))
			}
			groupDiv.appendChild(document.createElement("br"))
			testDiv.appendChild(groupDiv)
		}
		document.body.appendChild(testDiv)
	}, t)
}

export function testMaps(t) {
	console.log("testing maps...")

	setTimeout(() => {
		let testDiv = document.createElement("div")
		addTestHeader("Map Test", testDiv, document.body)
		for (let mapName in maps.elements) {
			if (mapName.startsWith(".")) continue
			let subDiv = document.createElement("div")
			subDiv.setAttribute("style", "display:inline-block;margin:8px;")
			let h2 = document.createElement("h2")
			h2.appendChild(document.createTextNode(mapName))
			subDiv.appendChild(h2)
			subDiv.appendChild(mapsRender.generateImageForMap(maps.elements[mapName], mapName))
			testDiv.appendChild(subDiv)
		}
		document.body.appendChild(testDiv)
	}, t)
}

export function testImages(t) {
	console.log("testing images...")

	setTimeout(() => {
		let testImagesDiv = document.createElement("div")
		addTestHeader("Image Test", testImagesDiv, document.body)
		for (let exf in extracted) {
			if (
				exf.startsWith("img/") && (
				exf.endsWith(".png") ||
				exf.endsWith(".gif") ||
				exf.endsWith(".jpg") ||
				exf.endsWith(".jpeg")
				)
			) {
				let newImg = document.createElement("img")
				newImg.setAttribute("src", extracted[exf])
				newImg.setAttribute("width", "32px")
				newImg.setAttribute("height", "32px")
				newImg.setAttribute("style", "image-rendering: crisp-edges;")
				testImagesDiv.appendChild(newImg)
			}
		}
		testImagesDiv.appendChild(document.createElement("br"))
		testImagesDiv.appendChild(document.createElement("br"))
		document.body.appendChild(testImagesDiv)
	}, t)
}

function addTestHeader(t, parent) {
	if (!parent) parent = document.body
	let h1 = document.createElement("h1")
	h1.appendChild(document.createTextNode(t))
	parent.appendChild(h1)
	parent.appendChild(document.createElement("br"))
}