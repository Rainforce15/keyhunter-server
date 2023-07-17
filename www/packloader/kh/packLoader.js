import JSZip from "/lib/jszip.min.js"
import { bytesToBase64 } from "/lib/base64.js"
import * as util from "/packloader/kh/util.js"
import { avgTimeAction, setTimer, getTimer } from "/packloader/kh/timer.js"
import * as maps from "/packloader/kh/maps.js"
import * as items from "/packloader/kh/items.js"
import * as pathing from "/packloader/kh/pathing.js"

let body, dl, dlpb, ex2, ex2pb, conv, convpb, mainProgressBars


export let extracted
let filesMeta
let currentExtracted
let filesTotal
let currentSizeExtracted
let fileSizeTotal

function setupDomRefs() {
	body = document.body
	dl = document.getElementById("dl")
	dlpb = document.getElementById("dlpb")
	ex2 = document.getElementById("ex2")
	ex2pb = document.getElementById("ex2pb")
	conv = document.getElementById("conv")
	convpb = document.getElementById("convpb")
	mainProgressBars = document.getElementById("mainProgressBars")
}

export function loadPack(url) {
	setupDomRefs()

	console.log(`loading from ${url}`)
	extracted = {}
	let request = new XMLHttpRequest()
	request.responseType = "blob"
	request.addEventListener("progress", e => {
		let perc = util.formatPerc(e.loaded, e.total)
		console.log(`${perc} downloaded`)
		let percText = ""
		if (e.loaded/e.total === 1) {
			percText += ` (in ${getTimer("dl") / 1000}s)`
		}
		dl.innerHTML = perc + percText
		dlpb.style.width = perc
	})
	request.addEventListener("readystatechange", _ => {
		if (request.readyState === 2 && request.status === 200) {
			util.log("started DL...")
		} else if (request.readyState === 3) {
			util.log("in progress...")
		} else if (request.readyState === 4) {
			util.log("DL finished!")
			util.log("content:")
			util.log(request.response)
			unpack(request.response)
		}
	})
	request.open("get", url)
	setTimer("dl")
	request.send()
}

function unpack(blob) {
	let zip = new JSZip()
	zip.loadAsync(blob).then(zipData => {
		util.log("zip loaded, data:")
		util.log(zipData)
		filesMeta = zipData.files
		filesTotal = Object.keys(filesMeta).length
		currentExtracted = 0

		fileSizeTotal = 0
		currentSizeExtracted = 0
		for (let file in filesMeta) {
			if (filesMeta[file]._data && filesMeta[file]._data.uncompressedSize) {
				fileSizeTotal += filesMeta[file]._data.uncompressedSize
			}
		}
		util.log(`total size: ${fileSizeTotal}`)
		setTimer("ex")
		for (let file in filesMeta) {
			if (!filesMeta[file].dir) {
				(f =>
					zipData.file(f).async("uint8array").then(data => {
						extracted[f] = data
						currentSizeExtracted += data.length
						currentExtracted++
						checkExtractDone()
					}))(file)
			} else {
				currentExtracted++
				checkExtractDone()
			}
		}
	})
}
function checkExtractDone() {
	/*let perc = util.formatPerc(currentExtracted, filesTotal)
	console.log(perc + " extracted")
	ex.innerHTML = perc
	expb.style.width = perc;*/

	//console.log(perc2 + " size extracted")
	let perc2 = util.formatPerc(currentSizeExtracted, fileSizeTotal)
	let perc2Text = ""
	if (currentSizeExtracted / fileSizeTotal === 1) {
		perc2Text += ` (in ${getTimer("ex") / 1000}s)`
	}
	ex2.innerHTML = perc2 + perc2Text
	ex2pb.style.width = perc2

	if (currentExtracted === filesTotal) {
		util.log("done extracting...")
		preConversion()
	}
}
function preConversion() {
	let JSONFile
	let JSONerror
	let maxEx = Object.keys(extracted).length
	let curEx = 0
	setTimer("conv")
	for (let key in extracted) {
		let fileData = extracted[key]
		if (key.substring(key.length - 4) === ".png" && fileData[1] === 0x50 && fileData[2] === 0x4E && fileData[3] === 0x47) {
			extracted[key] = `data:image/png;base64, ${bytesToBase64(fileData)}`
		}
		else if (key.substring(key.length - 4) === ".gif" && fileData[0] === 0x47 && fileData[1] === 0x49 && fileData[2] === 0x46 && fileData[3] === 0x38 && fileData[5] === 0x61) {
			extracted[key] = `data:image/gif;base64, ${bytesToBase64(fileData)}`
		}
		else if ((key.substring(key.length - 4) === ".jpg" || key.substring(key.length - 4) === ".jpeg") && fileData[0] === 0xFF && fileData[1] === 0xD8 && fileData[2] === 0xFF) {
			extracted[key] = `data:image/jpeg;base64, ${bytesToBase64(fileData)}`
		}
		else if (key.substring(key.length - 5) === ".json") {
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
		else if (key.substring(key.length - 5) === ".yaml") {
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
		let perc3 = util.formatPerc(++curEx, maxEx)
		let perc3Text = ""
		if (curEx / maxEx === 1) {
			perc3Text += ` (in ${getTimer("conv") / 1000}s)`
		}
		conv.innerHTML = perc3 + perc3Text
		convpb.style.width = perc3

	}
	if (JSONerror) {
		let errorBody = document.createElement("div")
		errorBody.setAttribute("style", "white-space:pre;font-family:monospace")
		body.appendChild(document.createElement("br"))
		body.appendChild(document.createElement("br"))
		errorBody.appendChild(document.createTextNode(`JSON parsing failed for ${JSONFile}:\n\n`))
		errorBody.appendChild(document.createTextNode(JSONerror.message))
		body.appendChild(errorBody)
	} else {
		util.log("done preconversion, starting pack...")
		//console.log(extracted)
		startPack()
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
		if (maps.showEverything()) {
			maps.showEverything(false)
			maps.updateAllMapRender()
		} else {
			maps.showEverything(true)
			maps.updateAllMapRender()
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

function startPack() {
	setTimeout(() => {util.removeAllChildren(mainProgressBars); body.removeChild(mainProgressBars)}, 4000)
	loadConfig()
	if (body) {
		let timerFrame = document.createElement("div")
		timerFrame.setAttribute("class", "debugTimerFrame")
		timerFrame.setAttribute("style", "position:fixed;top:0;right:0;background:rgba(0,0,0,0.5);width:320px;z-index:1;padding:8px;border-radius:0 0 0 8px;")
		timerFrame.appendChild(document.createTextNode("Item Calc+Render Time: "))
		let itemTimeSpan = document.createElement("span")
		itemTimeSpan.setAttribute("id", "itemRenderTime")
		timerFrame.appendChild(itemTimeSpan)
		timerFrame.appendChild(document.createElement("br"))
		timerFrame.appendChild(document.createTextNode("Map Calc+Render Time: "))
		let mapTimeSpan = document.createElement("span")
		mapTimeSpan.setAttribute("id", "mapRenderTime")
		timerFrame.appendChild(mapTimeSpan)
		body.appendChild(timerFrame)
	}
	items.load(extracted, groupdistance)
	maps.load(extracted)


	setInterval(()=>{
		if(!updateLoopInterrupt) {
			let avgItemCalcTime = avgTimeAction(items.updateAllItemData, "itemCalcTimes")
			let avgItemRenderTime = avgTimeAction(items.updateAllItemRender, "itemRenderTimes")
			document.getElementById("itemRenderTime").innerHTML = `${avgItemCalcTime} + ${avgItemRenderTime}ms`

			let avgMapCalcTime = avgTimeAction(maps.updateAllMapData, "mapCalcTimes")
			let avgMapRenderTime = avgTimeAction(maps.updateAllMapRender, "mapRenderTimes")
			document.getElementById("mapRenderTime").innerHTML = `${avgMapCalcTime} + ${avgMapRenderTime}ms`
		}
	}, 500)
}

let groupdistance = 32

function loadConfig() {
	let config = extracted["config.yaml"] || extracted["config.json"]
	if (config.groupdistance) groupdistance = config.groupdistance
}


/*
63C: room ID on current level


C3A: current dungeon room

C35: BG music?
c39: level?
c3F: level?

TODO: dungeon shuffle, pollspeed, checkable, hardmode, eval loop (instant update of canRemoveBushes/etc. make an array of all items and iterate and skip until you can't no more)
*/