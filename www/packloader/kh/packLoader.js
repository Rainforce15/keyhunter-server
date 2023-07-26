import JSZip from "/lib/jszip.min.js"
import {bytesToBase64} from "/lib/base64.js"
import * as util from "/packloader/kh/util.js"
import {avgTimeAction} from "/packloader/kh/timer.js"
import * as maps from "/packloader/kh/maps.js"
import * as mapsRender from "/packloader/kh/mapsRender.js"
import * as items from "/packloader/kh/items.js"
import * as itemsRender from "/packloader/kh/itemsRender.js"
import * as pathing from "/packloader/kh/pathing.js"

export let extracted

function defaultProgress(currentSizeExtracted, fileSizeTotal, startTime) {}

export async function loadPack(url, downloadProgress, extractedProgress, conversionProgress, timerUpdate) {
	console.log(`loading from ${url}`)

	let zipFile = await download(url, downloadProgress)
	extracted = await unpack(zipFile, extractedProgress)
	await preConversion(conversionProgress)

	let conf = loadConfig()
	let itemData = items.init(conf)
	let mapData = maps.init()

	startPack(itemData, mapData, timerUpdate)
}

function download(url, progressFeedback = defaultProgress) {return new Promise((resolve, reject) => {
	let startTime = Date.now()
	let request = new XMLHttpRequest()
	request.responseType = "blob"
	request.addEventListener("progress", e => progressFeedback(e.loaded, e.total, startTime))
	request.addEventListener("readystatechange", async _ => {
		if (request.readyState === 2 && request.status === 200) {
			util.log("started DL...")
		} else if (request.readyState === 3) {
			util.log("in progress...")
		} else if (request.readyState === 4) {
			util.log("DL finished!")
			util.log("content:")
			util.log(request.response)
			resolve(request.response)
		}
	})
	request.addEventListener("error", e => {
		console.error(e)
		reject(e)
	})
	request.open("get", url)
	request.send()
})}

async function unpack(blob, progressFeedback = defaultProgress) {
	let zip = new JSZip()
	let zipData = await zip.loadAsync(blob)
	let extracted = {}

	util.log("zip loaded, data:")
	util.log(zipData)
	let filesMeta = {}
	let allFiles = zipData.files
	for (let fileName in allFiles) {
		let curFile = allFiles[fileName]
		if (!curFile.dir) filesMeta[fileName] = curFile
	}
	console.log(filesMeta)
	let fileNames = Object.keys(filesMeta)
	console.log(fileNames)

	let fileSizeTotal = 0
	let currentSizeExtracted = 0
	for (let file in filesMeta) {
		if (filesMeta[file]._data?.uncompressedSize) {
			fileSizeTotal += filesMeta[file]._data.uncompressedSize
		}
	}
	util.log(`total size: ${fileSizeTotal}`)
	let startTime = Date.now()

	await Promise.all(fileNames.map(async fileName => {
		let data = await zipData.file(fileName).async("uint8array")
		extracted[fileName] = data
		currentSizeExtracted += data.length
		progressFeedback(currentSizeExtracted, fileSizeTotal, startTime)
	}))

	util.log("done extracting...")
	console.log("done extracting")

	return extracted
}

async function preConversion(progressFeedback = defaultProgress) {
	let JSONFile
	let JSONerror
	let maxEx = Object.keys(extracted).length
	let curEx = 0
	let startTime = Date.now()

	for (let key in extracted) {
		let fileData = extracted[key]
		if (key.endsWith(".png") && fileData[1] === 0x50 && fileData[2] === 0x4E && fileData[3] === 0x47) {
			extracted[key] = `data:image/png;base64, ${bytesToBase64(fileData)}`
		}
		else if (key.endsWith(".gif") && fileData[0] === 0x47 && fileData[1] === 0x49 && fileData[2] === 0x46 && fileData[3] === 0x38 && fileData[5] === 0x61) {
			extracted[key] = `data:image/gif;base64, ${bytesToBase64(fileData)}`
		}
		else if ((key.endsWith(".jpg") || key.endsWith(".jpeg")) && fileData[0] === 0xFF && fileData[1] === 0xD8 && fileData[2] === 0xFF) {
			extracted[key] = `data:image/jpeg;base64, ${bytesToBase64(fileData)}`
		}
		else if (key.endsWith(".json")) {
			try {
				extracted[key] = util.utf8ArrayToYaml(fileData)
			} catch(e) {
				console.log(`JSON parsing failed for ${key}:`)
				console.log(e)
				console.log(`data of ${key}:`)
				console.log(util.cleanJSON(util.Utf8ArrayToStr(fileData)).split("\n"))
				JSONFile = key
				JSONerror = e
			}
		}
		else if (key.endsWith(".yaml")) {
			try {
				extracted[key] = util.utf8ArrayToYaml(fileData)
			} catch(e) {
				console.log(`YAML parsing failed for ${key}:`)
				console.log(e)
				console.log(`data of ${key}:`)
				console.log(util.cleanJSON(util.Utf8ArrayToStr(fileData)).split("\n"))
				JSONFile = key
				JSONerror = e
			}
		}
		progressFeedback(++curEx, maxEx, startTime)
	}
	if (JSONerror) {
		throw `JSON parsing failed for ${JSONFile}:\n\n${JSONerror.message}`
	} else {
		util.log("done preconversion, starting pack...")
	}
}

document.addEventListener("keypress", e => {
	if (e.key === "1") {
		if (showLocations) {
			document.head.removeChild(showLocations)
			showLocations = undefined
		} else {
			showLocations = document.createElement("style")
			showLocations.innerHTML = ".map_location {visibility:hidden}"
			document.head.appendChild(showLocations)
		}
		e.stopPropagation()
		e.preventDefault()
		return false;
	}
	if (e.key === "2") {
		if (showLines) {
			document.head.removeChild(showLines)
			showLines = undefined
		} else {
			showLines = document.createElement("style")
			showLines.innerHTML = ".map_line {visibility:hidden}"
			document.head.appendChild(showLines)
		}
		e.stopPropagation()
		e.preventDefault()
		return false;
	}
	if (e.key === "3") {
		if (mapsRender.showEverything()) {
			mapsRender.showEverything(false)
			mapsRender.updateAllMapRender()
		} else {
			mapsRender.showEverything(true)
			mapsRender.updateAllMapRender()
		}
		e.stopPropagation()
		e.preventDefault()
		return false;
	}
	if (e.key === "p") {
		if (!pathing.debug()) {
			console.log("dumping pathing data:")
			pathing.debug(true)
		}
		e.stopPropagation()
		e.preventDefault()
		return false;
	}
	if (e.key === "Pause") {
		if (updateLoopInterrupt) {
			console.log("continuing...")
			updateLoopInterrupt = false
		} else {
			console.log("calc+render paused until next press of [Pause].")
			updateLoopInterrupt = true
		}
		e.stopPropagation()
		e.preventDefault()
		return false;
	}
})


let updateLoopInterrupt = false
let showLocations
let showLines
showLines = document.createElement("style")
showLines.innerHTML = ".map_line {visibility:hidden}"
document.head.appendChild(showLines)

function startPack(itemData, mapData, timerUpdate = (timers) => {}) {
	setInterval(()=>{
		if(!updateLoopInterrupt) {
			timerUpdate({
				items: {
					calc: avgTimeAction(items.updateAllItemData, "itemCalcTimes"),
					render: avgTimeAction(itemsRender.updateAllItemRender, "itemRenderTimes")},
				maps: {
					calc: avgTimeAction(maps.updateAllMapData, "mapCalcTimes"),
					render: avgTimeAction(mapsRender.updateAllMapRender, "mapRenderTimes")
				}
			})
		}
	}, 500)
}

function loadConfig() {
	return extracted["config.yaml"] || extracted["config.json"]
}


/*
63C: room ID on current level


C3A: current dungeon room

C35: BG music?
c39: level?
c3F: level?

TODO: dungeon shuffle, pollspeed, checkable, hardmode, eval loop (instant update of canRemoveBushes/etc. make an array of all items and iterate and skip until you can't no more)
*/