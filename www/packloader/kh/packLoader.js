import JSZip from "/lib/jszip.min.js"
import jsyaml from "/lib/js-yaml.min.js"
import { bytesToBase64 } from "/lib/base64.js"

let body, dl, dlpb, ex2, ex2pb, conv, convpb, mainProgressBars

let PL = new function pl () {
	function formatPerc(a,b) {
		return Math.round(a/b*10000)/100+"%"
	}

	let extracted
	let filesMeta
	let currentExtracted
	let filesTotal
	let currentSizeExtracted
	let fileSizeTotal
	let dlStart
	let exStart

	let items
	let maps

	let logPackLoader = false
	function log(msg) {
		if (logPackLoader) console.log(msg)
	}

	function Utf8ArrayToStr(array) {
		let out, i, len, c
		let char2, char3
		out = ""
		len = array.length
		i = 0
		while(i < len) {
			c = array[i++]
			switch(c >> 4) {
			  case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
				// 0xxxxxxx
				out += String.fromCharCode(c)
				break
			  case 12: case 13:
				// 110x xxxx   10xx xxxx
				char2 = array[i++]
				out += String.fromCharCode(
					((c & 0x1F) << 6) |
					(char2 & 0x3F)
				)
				break
			  case 14:
				// 1110 xxxx  10xx xxxx  10xx xxxx
				char2 = array[i++]
				char3 = array[i++]
				out += String.fromCharCode(
					((c & 0x0F) << 12) |
					((char2 & 0x3F) << 6) |
					((char3 & 0x3F) << 0)
				)
				break
			}
		}
		return out
	}

	function utf8ArrayToYaml(array) {
		//let jsonStr = cleanJSON(Utf8ArrayToStr(array))
		//return JSON.parse(jsonStr)
		let yamlStr = Utf8ArrayToStr(array).replace(/\t/g, " "); //lol yaml
		return jsyaml.safeLoad(yamlStr)
	}

	//do not worry dear, we are magically fixing everything that is naturally wrong with you. (a.k.a. your parents were like "lol what json spec")
	function cleanJSON(str) {
		return str
			.replace(/^\uFEFF/, "") //remove BOM
			.replace(/(\r\n)/g, "\n") //convert newlines
			.replace(/\/\/.*?\n/g, "\n") //drop line comments
			.replace(/\/\*(.|\n)*?\*\//g, "") //drop block comments
			.replace(/,\s*?(?=[}\],])/g, "") //drop double/trailing commas
	}

	function loadPack(url) {
		body = document.body
		dl = document.getElementById("dl")
		dlpb = document.getElementById("dlpb")
		ex2 = document.getElementById("ex2")
		ex2pb = document.getElementById("ex2pb")
		conv = document.getElementById("conv")
		convpb = document.getElementById("convpb")
		mainProgressBars = document.getElementById("mainProgressBars")

		console.log("loading from "+url)
		extracted = {}
		let request = new XMLHttpRequest()
		request.responseType = 'blob'
		request.addEventListener("progress", e => {
			let perc = formatPerc(e.loaded,e.total)
			console.log(perc+" downloaded")
			dl.innerHTML = perc+((e.loaded/e.total === 1)?" (in "+((new Date())-dlStart)/1000+"s)":"")
			dlpb.style.width = perc
		})
		request.addEventListener("readystatechange", _ => {
			if (request.readyState === 2 && request.status === 200) {
				log("started DL...")
			} else if (request.readyState === 3) {
				log("in progress...")
			} else if (request.readyState === 4) {
				log("DL finished!")
				log("content:")
				log(request.response)
				unpack(request.response)
			}
		})
		request.open("get", url)
		dlStart = new Date()
		request.send()
	}
	this.loadPack = loadPack

	function unpack(blob) {
		let zip = new JSZip()
		zip.loadAsync(blob).then(zipData => {
			log("zip loaded, data:")
			log(zipData)
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
			log("total size: "+fileSizeTotal)
			exStart = new Date()
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
		/*let perc = formatPerc(currentExtracted,filesTotal)
		console.log(perc+" extracted")
		ex.innerHTML = perc
		expb.style.width = perc;*/

		//console.log(perc2+" size extracted")
		let perc2 = formatPerc(currentSizeExtracted,fileSizeTotal)
		ex2.innerHTML = perc2+((currentSizeExtracted/fileSizeTotal === 1)?" (in "+((new Date())-exStart)/1000+"s)":"")
		ex2pb.style.width = perc2

		if (currentExtracted === filesTotal) {
			log("done extracting...")
			//console.log(extracted)
			preConversion()
		}
	}

	function preConversion() {
		let JSONFile
		let JSONerror
		let maxEx = Object.keys(extracted).length
		let curEx = 0
		let exStart = new Date()
		for (let key in extracted) {
			let fileData = extracted[key]
			if (key.substring(key.length - 4) === ".png" && fileData[1] === 0x50 && fileData[2] === 0x4E && fileData[3] === 0x47) {
				extracted[key] = "data:image/png;base64, " + bytesToBase64(fileData)
			}
			else if (key.substring(key.length - 4) === ".gif" && fileData[0] === 0x47 && fileData[1] === 0x49 && fileData[2] === 0x46 && fileData[3] === 0x38 && fileData[5] === 0x61) {
				extracted[key] = "data:image/gif;base64, " + bytesToBase64(fileData)
			}
			else if ((key.substring(key.length - 4) === ".jpg" || key.substring(key.length - 4) === ".jpeg") && fileData[0] === 0xFF && fileData[1] === 0xD8 && fileData[2] === 0xFF) {
				extracted[key] = "data:image/jpeg;base64, " + bytesToBase64(fileData)
			}
			else if (key.substring(key.length - 5) === ".json") {
				try {
					extracted[key] = utf8ArrayToYaml(fileData)
				} catch(e) {
					console.log("JSON parsing failed for "+key+":")
					console.log(e)
					console.log("data of "+key+":")
					console.log(cleanJSON(Utf8ArrayToStr(fileData)).split("\n"))
					JSONFile = key
					JSONerror = e
				}
			}
			else if (key.substring(key.length - 5) === ".yaml") {
				try {
					extracted[key] = utf8ArrayToYaml(fileData)
				} catch(e) {
					console.log("YAML parsing failed for "+key+":")
					console.log(e)
					console.log("data of "+key+":")
					console.log(cleanJSON(Utf8ArrayToStr(fileData)).split("\n"))
					JSONFile = key
					JSONerror = e
				}
			}
			let perc3 = formatPerc(++curEx,maxEx)
			conv.innerHTML = perc3+((curEx/maxEx === 1)?" (in "+((new Date())-exStart)/1000+"s)":"")
			convpb.style.width = perc3

		}
		if (JSONerror) {
			let errorBody = document.createElement("div")
			errorBody.setAttribute("style", "white-space:pre;font-family:monospace")
			body.appendChild(document.createElement("br"))
			body.appendChild(document.createElement("br"))
			errorBody.appendChild(document.createTextNode("JSON parsing failed for "+JSONFile+":\n\n"))
			errorBody.appendChild(document.createTextNode(JSONerror.message))
			body.appendChild(errorBody)
		} else {
			log("done preconversion, starting pack...")
			//console.log(extracted)
			startPack()
		}
	}

	document.addEventListener("keyup", e => {
		if (!showEverything && !e.shiftKey) {
			showEverything = true
			updateAllMapRender()
		}
		if (e.key === "p") {
			if (!debugPathing) {
				console.log("dumping pathing data:")
				debugPathing = true
			}
		}
		if (e.key === "1") {
			if (showLocations) {
				document.head.removeChild(showLocations)
				showLocations = undefined
			} else {
				showLocations = document.createElement("style")
				showLocations.innerHTML = ".map_location {visibility:hidden}"
				document.head.appendChild(showLocations)
			}
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
		}
		if (e.key === "Pause") {
			if (updateLoopInterrupt) {
				console.log("continuing...")
				updateLoopInterrupt = false
			} else {
				console.log("calc+render paused until next press of [Pause].")
				updateLoopInterrupt = true
			}
		}
	})
	document.addEventListener("keydown", e => {
		if (showEverything && e.shiftKey) {
			showEverything = false
			updateAllMapRender()
		}
	})

	let debugPathing = false
	let updateLoopInterrupt = false
	let timeAvgLen = 128
	let itemCalcTimes = []
	let itemRenderTimes = []
	let mapCalcTimes = []
	let mapRenderTimes = []
	let showEverything = true
	let showLocations
	let showLines

	function avgTimeAction(action, history) {
		let startTime = new Date()
		action()
		history.unshift(new Date() - startTime)
		if (history.length > timeAvgLen) history.pop()
		return Math.round((history.reduce((sum,cur) => sum + cur)/history.length)*100)/100
	}

	function removeAllChildren(node) {
		while (node.firstChild) {
			removeAllChildren(node.firstChild)
			node.removeChild(node.firstChild)
		}
	}

	function startPack() {
		setTimeout(() => {removeAllChildren(mainProgressBars); body.removeChild(mainProgressBars)}, 4000)
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
		loadItems()
		loadMaps()


		setInterval(()=>{
			if(!updateLoopInterrupt) {
				let avgItemCalcTime = avgTimeAction(updateAllItemData, itemCalcTimes)
				let avgItemRenderTime = avgTimeAction(updateAllItemRender, itemRenderTimes)
				document.getElementById("itemRenderTime").innerHTML = avgItemCalcTime + " + " + avgItemRenderTime + "ms"

				let avgMapCalcTime = avgTimeAction(updateAllMapData, mapCalcTimes)
				let avgMapRenderTime = avgTimeAction(updateAllMapRender, mapRenderTimes)
				document.getElementById("mapRenderTime").innerHTML = avgMapCalcTime + " + " + avgMapRenderTime + "ms"
			}
		}, 500)

		testMaps(100)
		testItems(200)
		testImages(300)
	}

	let groupdistance = 32

	function loadConfig() {
		let config = extracted["config.yaml"] || extracted["config.json"]
		if (config.groupdistance) groupdistance = config.groupdistance
	}

	function parseIntString(n) {
		let ret = null
		if (typeof n === "string") {
			let numString = n
			if (n[0] === "-") numString = n.substring(1)
			if (numString.substring(0, 2) === "0b") ret = parseInt(numString.substring(2), 2)
			else if (numString.substring(0, 2) === "0o") ret = parseInt(numString.substring(2), 8)
			else if (numString.substring(0, 2) === "0x") ret = parseInt(numString.substring(2), 16)
			else ret = parseInt(numString, 16)
			ret *=  ((n[0] === "-")?-1:1)
		} else if (typeof n === "number") {
			ret = n
		}
		if (ret === null || Number.isNaN(ret)) throw "invalid numeric type: "+n
		else return ret
	}

	let memIndex = {}
	let newMem = {}
	let memGroups = {}
	//  ..[[]] [[]] [[]]..  


	function addToMemGroups(memType, address) {
		log("memGroups so far:", JSON.stringify(memGroups))
		log("adding ", address)
		if (!memGroups[memType]) memGroups[memType] = []
		let group = memGroups[memType]
		for (let i = 0; i < group.length; i++) {
			//XX..[[]]  [[]]..  
			if (i === 0 && address < group[0][0] - groupdistance) {
				group.unshift([address, address])
				return
			}
			//  XX[[]]  [[]]..  
			if (address >= group[i][0] - groupdistance && address < group[i][0]) {
				group[i][0] = address
				return
			}
			//  ..XXXX  [[]]..  
			if (address >= group[i][0] && address <= group[i][1]) {
				return
			}
			//  ..[[]]XX[[]]..  
			if (i > 0 && address > group[i-1][1] + groupdistance && address < group[i][0] - groupdistance) {
				group.splice(i, 0, [address, address])
				return
			}
			//  ..[[]]  [[]]XX  
			if (address <= group[i][1] + groupdistance && address > group[i][1]) {
				group[i][1] = address
				return
			}
			//  ..[[]]  [[]]..XX
			if (i === group.length-1 && address > group[group.length-1][1] + groupdistance) {
				group.push([address, address])
				return
			}
		}
		if (group.length === 0) {
			group.push([address, address])
		}
	}

	function parseAllFlagsAndIndex(mem) {
		if (mem) {
			for (let memType in mem) {
				let memList = mem[memType]
				if (memList.or) memList = memList.or
				for (let i = 0; i < memList.length; i++) {
					parseFlagAndIndex(memList[i], memType)
				}
			}
		}
	}
	function parseFlagAndIndex(flag, memType) {
		flag[0] = (flag[0] !== "" && flag[0] !== null && flag[0] !== undefined)?parseIntString(flag[0]):""
		if (flag[1]) flag[1] = parseIntString(flag[1])

		if (flag[0] !== "" && (flag[1] === undefined || flag[1] !== "")) {
			if (!memIndex[memType]) memIndex[memType] = {}
			memIndex[memType][flag[0]] = 0
			addToMemGroups(memType, flag[0])
		}
	}
	function hasMemValue(mem, memType, flagIndex, flagPart) {
		return mem &&
			mem[memType] &&
			mem[memType][flagIndex] &&
			mem[memType][flagIndex][flagPart]
	}

	function applyBaseRendername(obj) {
		for (let key in obj) {
			let entry = obj[key]
			if (entry === undefined) continue
			entry.basename = key
			entry.rendername = key.replace(/ /g,"_")
		}
	}
	function applyTemplates(obj, templateSource, type) {
		if (!templateSource) templateSource = obj
		for (let key in obj) {
			let entry = obj[key]
			if (entry === undefined) continue
			if (entry.t) entry.template = entry.t
			if (!entry.template) continue
			if (typeof entry.template === "string") entry.template = [entry.template]
			for (let templateName of entry.template) {
				let template = templateSource["__" + templateName]
				if (!template) {
					console.error("no template found for key: ", templateName)
					console.log("templateSource: ", templateSource)
				}
				if (template.template) entry.template = [...entry.template, ...template.template]
				for (let tKey in template) {
					if (entry[tKey] === undefined) entry[tKey] = JSON.parse(JSON.stringify(template[tKey]))
				}
				if (type === "item") {
					// --stages--
					//generate stages based on template
					if(!entry.stages && template.stages && entry.mem) {
						let oldMem = entry.mem
						delete entry.mem
						entry.stages = JSON.parse(JSON.stringify(template.stages))
						for (let stage of entry.stages) {
							for (let memType in stage.mem) {
								for (let i = 0; i < stage.mem[memType].length; i++) {
									let flag = stage.mem[memType][i]
									if (hasMemValue(oldMem, memType, i, 0)) flag[0] = oldMem[memType][i][0]
									if (hasMemValue(oldMem, memType, i, 1)) flag[1] = oldMem[memType][i][1]
								}
							}
						}
					}
					//fill stages with template/mem
					if (entry.stages) {
						for (let stageIndex = 0; stageIndex < entry.stages.length; stageIndex++) {
							let stage = entry.stages[stageIndex]
							
							if (stage.mem) {
								for (let memType in stage.mem) {
									for (let flagIndex = 0; flagIndex < stage.mem[memType].length; flagIndex++) {
										let flag = stage.mem[memType][flagIndex]
										if (entry.mem && entry.mem[memType]) {
											if (!flag[0] && hasMemValue(entry.mem, memType, flagIndex, 0)) {
												flag[0] = entry.mem[memType][flagIndex][0]
											}
											if (!flag[1] && hasMemValue(entry.mem, memType, flagIndex, 1)) {
												flag[1] = entry.mem[memType][flagIndex][1]
											}
										}
									}
									if (entry.mem && entry.mem[memType].length > stage.mem[memType].length) {
										for (let flagIndex = stage.mem[memType].length; flagIndex < entry.mem[memType].length; flagIndex++) {
											stage.mem[memType].push(entry.mem[memType][flagIndex])
										}
									}
								}
								if (entry.mem) {
									for (let memType in entry.mem) {
										if (!stage.mem[memType]) stage.mem[memType] = entry.mem[memType]
									}
								}
							}
						}
					}
					
					// --regular mem--
					for (let memKey of ["mem", "countMem", "forceMem"]) {
						for (let memType in entry[memKey]) {
							for (let flagIndex = 0; flagIndex < entry[memKey][memType].length; flagIndex++) {
								let flag = entry[memKey][memType][flagIndex]
								if (entry.template) {
									for (let innerTemplateName of entry.template) {
										let innerTemplate = templateSource["__"+innerTemplateName]
										if (innerTemplate) {
											if (!flag[0] && hasMemValue(innerTemplate[memKey], memType, flagIndex, 0)) {
												flag[0] = innerTemplate[memKey][memType][flagIndex][0]
											}
											if (!flag[1] && hasMemValue(innerTemplate[memKey], memType, flagIndex, 1)) {
												flag[1] = innerTemplate[memKey][memType][flagIndex][1]
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}

	function parseItemMemStringsAndIndex(items) {
		for (let itemName in items) { //fix shortcuts
			let item = items[itemName]
			for (let memKey of ["mem", "countMem", "forceMem"]) {
				if (item[memKey]) {
					for (let memType in item[memKey]) {
						if (Array.isArray(item[memKey][memType]) && !Array.isArray(item[memKey][memType][0])) item[memKey][memType] = [item[memKey][memType]]
					}
				}
			}
			if (item.stages) {
				for (let stage of item.stages) {
					if (stage.mem) {
						for (let memType in stage.mem) {
							if (Array.isArray(stage.mem[memType]) && !Array.isArray(stage.mem[memType][0])) stage.mem[memType] = [stage.mem[memType]]
						}
					}
				}
			}
		}
		applyTemplates(items, items, "item")
		for (let itemName in items) {
			let item = items[itemName]
			//if (itemName.substr(0,2) === "__") continue
			if (item.countMap) {
				item.countMapSorted = JSON.parse(JSON.stringify(item.countMap)).sort((a,b) => b-a)
				let countIgnoreMap = item.countIgnoreMap = []
				for (let i = 0; i < item.countMap.length; i++) {
					if (i%8 === 0) {
						countIgnoreMap.push(0)
					}
					if (item.countMap[i] === 0) {
						if (i%8 === 0) countIgnoreMap[countIgnoreMap.length - 1] |= 0x80
						if (i%8 === 1) countIgnoreMap[countIgnoreMap.length - 1] |= 0x40
						if (i%8 === 2) countIgnoreMap[countIgnoreMap.length - 1] |= 0x20
						if (i%8 === 3) countIgnoreMap[countIgnoreMap.length - 1] |= 0x10
						if (i%8 === 4) countIgnoreMap[countIgnoreMap.length - 1] |= 0x08
						if (i%8 === 5) countIgnoreMap[countIgnoreMap.length - 1] |= 0x04
						if (i%8 === 6) countIgnoreMap[countIgnoreMap.length - 1] |= 0x02
						if (i%8 === 7) countIgnoreMap[countIgnoreMap.length - 1] |= 0x01
					}
				}
			}
			if (item.maxAmount && typeof item.maxAmount === "string") {
				if (!items[item.maxAmount].maxCaps) items[item.maxAmount].maxCaps = []
				items[item.maxAmount].maxCaps.push(item.basename)
			}
			item.curStage = (item.noOffStage || item.noStageAlert)?1:0

			//parsing, indexing
			if (item.stages) {
				for (let stage of item.stages) parseAllFlagsAndIndex(stage.mem)
			}
			for (let memKey of ["mem", "countMem", "forceMem"]) {
				parseAllFlagsAndIndex(item[memKey])
			}
		}
		//final group test pass
		
		for (let memType in memGroups) {
			let group = memGroups[memType]
			for (let i = 0; i < group.length - 1; i++) {
				if (i > 0 && group[i-1][1] >= group[i][0] - groupdistance) {
					if (group[i-1][1] < group[i][1]) group[i-1][1] = group[i][1]
					group.splice(i,1)
					i--
				}
			}
		}
		console.log(items)
		console.log(memIndex)
		console.log(memGroups)
	}

	function loadItems() {
		items = extracted["items.yaml"] || extracted["items.json"]
		if (!items) {
			console.error("no item.yaml/json definition.")
			return
		}
		console.log("loading items...")
		console.log(items)
		for (let itemName in items) {
			if (!items[itemName]) items[itemName] = {}
		}
		applyBaseRendername(items)
		applyTemplates(items)
		parseItemMemStringsAndIndex(items)
		for (let itemName in items) {
			items[itemName].imgDomRefs = []
			items[itemName].titleDomRefs = []
		}

		readItemData()
		setInterval(readItemData, 1000)
		wsListeners.push(addressHandler)
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
			if (connectionNameParts.length > 2) console.warn("couldn't parse loc reference: "+connectionName)
			let connectionMap = connectionNameParts.length > 1?maps[connectionNameParts[0]]:map
			let connectionLoc = connectionNameParts.length > 1?connectionNameParts[1]:connectionNameParts[0]
			if (!connectionMap) console.warn("could not find map for "+connectionName)
			if (!connectionLoc) console.warn("could not find location for "+connectionName)

			loc[attribute][connectionName] = fixUpReq(loc[attribute][connectionName])

			let connectionData = loc[attribute][connectionName]
			if (connectionMap.locations[connectionLoc]) {
				let target = connectionMap.locations[connectionLoc]
				connectionData.ref = target
				let locName = (connectionMap!==map?map.basename+"::":"")+loc.basename
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
		if (obj.wh !== undefined) {
			if (typeof obj.wh === "number" || typeof obj.wh === "string") {
				obj.width = obj.wh
				obj.height = obj.wh
			} else if (Array.isArray(obj.wh) && obj.wh.length === 2) {
				obj.width = obj.wh[0]
				obj.height = obj.wh[1]
			}
		}
		for (let subType of ["", "Factor", "Offset", "2", "2Factor", "2Offset"]) {
			if (typeof obj["xy"+subType] === "number" || typeof obj["xy"+subType] === "string") {
				obj["x"+subType] = obj["xy"+subType]
				obj["y"+subType] = obj["xy"+subType]
			} else if (Array.isArray(obj["xy"+subType]) && obj["xy"+subType].length === 2) {
				obj["x"+subType] = obj["xy"+subType][0]
				obj["y"+subType] = obj["xy"+subType][1]
			}
		}
	}

	function loadMaps() {
		maps = extracted["maps.yaml"] || extracted["maps.json"]
		console.log("loading maps...")
		console.log(maps)
		applyBaseRendername(maps)
		for (let mapName in maps) {
			let map = maps[mapName]
			if (map.parts) {
				applyTemplates(map.parts, maps.__templates.parts)
				applyBaseRendername(map.parts)
				for (let partName in map.parts) {
					map.parts[partName].parentMapName = map.basename
					map.parts[partName].domRefs = []
					extractXYWH(map.parts[partName])
					
				}
			}
			if (map.locations) {
				applyTemplates(map.locations, maps.__templates.locations)
				applyBaseRendername(map.locations)
				for (let locName in map.locations) {
					let locData = map.locations[locName]
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

		checkPaths()
		pathMaps()
		let lostLocs = []
		for (let mapName in maps) {
			let map = maps[mapName]
			if (map.locations) {
				for (let locName in map.locations) {
					let locData = map.locations[locName]
					if (locData === undefined) continue
					if (!locData.connectedToEntryPoint) {
						lostLocs.push(mapName+"::"+locName)
					}
				}
			}
		}
		if (lostLocs.filter(e=>e.substring(0, 2) !== "__").length > 0) console.warn("unconnected location(s): "+lostLocs.filter(e=>e.substring(0, 2) !== "__").join(", "))

		console.log(maps)
		console.log("done")
	}

	function readItemData() {
		//update mem
		for (let memType in newMem) {
		console.log("type: "+memType, newMem)
			for (let memLoc of newMem[memType]) {
				//console.log("sending:", JSON.stringify({o:"write_u8", a:memLoc[0], v:memLoc[1], d:memType}))
				let payload = JSON.stringify({o:"write_u8", a:memLoc[0], v:memLoc[1], d:memType})
				console.log("payload: "+payload)
				if (isSocketOpen()) socket.send(payload)
			}
		}
		newMem = {}

		//fetch new data
		for (let memType in memGroups) {
			let group = memGroups[memType]
			for(let i = 0; i < group.length; i++) {
				let payload = JSON.stringify({o:"readbyterange", l:group[i][1] - group[i][0] + 1, a:group[i][0], d:memType})
				if (isSocketOpen()) socket.send(payload)
			}
		}
	}

	function isSocketOpen() {
		return socket != null && socket.readyState === socket.OPEN
	}

	function addressHandler(msg) {
		let parsedMsg
		try {
			parsedMsg = JSON.parse(msg.data)
		} catch (e) {
			console.error(e)
			console.error("JSON: "+msg.data)
		}
		if (memIndex[parsedMsg.d] && !parsedMsg.l) {
			memIndex[parsedMsg.d][parsedMsg.a] = parsedMsg.v
		}
		else if (memIndex[parsedMsg.d] && parsedMsg.l && parsedMsg.l === parsedMsg.v.length) {
			for (let i = 0; i < parsedMsg.l; i++) {
				memIndex[parsedMsg.d][parsedMsg.a+i] = parsedMsg.v[i]
			}
		}
	}

	function updateAllItemData() {
		for (let itemName in items) {
			updateItemData(items[itemName])
		}
	}
	function evaluateFlags(memData) {
		let memTypes = Object.keys(memData)
		for (let i = 0; i < memTypes.length; i++) {
			let typeData = memData[memTypes[i]]
			if (Array.isArray(typeData) && !flagsAnd(typeData, memTypes[i])) return 0
			else if (typeof typeData === "object" && typeData.or && !flagsOr(typeData.or, memTypes[i])) return 0
		}
		return 1
	}
	function flagsAnd(data, memType) {
		for (let j = 0; j < data.length; j++) {
			let flag = data[j]
			if (!flag || !flag[0] || !flag[1]) return false
			if (
				flag[1] > 0 && (memIndex[memType][flag[0]] & flag[1]) < flag[1] ||
				flag[1] < 0 && (memIndex[memType][flag[0]] & (-flag[1])) > 0
			) {
				return false
			}
		}
		return true
	}
	function flagsOr(data, memType) {
		for (let j = 0; j < data.length; j++) {
			let flag = data[j]
			if (
				flag &&
				flag[0] &&
				flag[1] && (
					flag[1] > 0 && (memIndex[memType][flag[0]] & flag[1]) === flag[1] ||
					flag[1] < 0 && (memIndex[memType][flag[0]] & (-flag[1])) === 0
				)
			) {
				return true
			}
		}
		return false
	}

	function evaluateStage(stage, debugField) {
		if (stage.mem) return evaluateFlags(stage.mem)
		else if (stage.or) return evaluateOr(stage.or, debugField)
		else if (stage.nor) return !evaluateOr(stage.nor, debugField)
		else if (stage.and) return evaluateAnd(stage.and, debugField)
		else if (stage.sum || stage.sub) return evaluateSumSub(stage.sum, stage.sub, stage.minAmount, stage.maxAmount)
	}
	function updateItemData(item) {
		if (item.stages) {
			item.curStage = item.noOffStage?1:0
			for (let i = 0; i < item.stages.length; i++) {
				let stageData = item.stages[i]
				let stageNumber = i+1
				if (evaluateStage(stageData, item.basename) && item.curStage < stageNumber) {
					item.curStage = stageNumber
				}
			}
			if (item.curStage === 0 && item.noStageAlert && item.basename.substring(0, 2) !== "__") {
				//console.log(JSON.stringify(memIndex, null, "  "))
				//alert("Unknown value for "+item.basename+". Dumping memory into console and moving on.")
			}
		} else if (item.countMem) {
			let memType = Object.keys(item.countMem)[0]
			let locMemIndex = memIndex[memType]
			item.curStage = 0
			for(let i = 0; i < item.countMem[memType].length; i++) {
				let val = locMemIndex[item.countMem[memType][i][0]]
				if (item.countMap) {
					let offset = 8 * i
					for (let j = 0; j < 8; j++) {
						if (((val << j) & 0x80) === 0x80) {
							item.curStage += item.countMap[offset + j]
						}
					}
				} else {
					let newStage = item.curStage + locMemIndex[item.countMem[memType][i][0]] * Math.pow(0x100, (item.countMem[memType].length-1-i))
					if (item.forceMax && item.forceMax < newStage) newStage = item.forceMax
					item.curStage = newStage
				}
			}
		} else {
			item.curStage = evaluateStage(item, item.basename)
		}
	}

	function evaluateOr(list, debugField) {
		if (Array.isArray(list)) {
			for (let i = 0; i < list.length; i++) {
				if (evaluateEntry(list[i], undefined, debugField)) return 1
			}
		} else if(typeof list === "object") {
			let keyList = Object.keys(list)
			for (let i = 0; i < keyList.length; i++) {
				if (evaluateEntry(keyList[i], list[keyList[i]], debugField)) return 1
			}
		}
		return 0
	}

	function evaluateAnd(list, debugField) {
		if (Array.isArray(list)) {
			for (let i = 0; i < list.length; i++) {
				if (!evaluateEntry(list[i], undefined, debugField)) return 0
			}
			return 1
		} else if(typeof list === "object") {
			let keyList = Object.keys(list)
			for (let i = 0; i < keyList.length; i++) {
				if (keyList[i] === "or") {
					if (!evaluateOr(list[keyList[i]], debugField)) return 0
				} else {
					if (!evaluateEntry(keyList[i], list[keyList[i]], debugField)) return 0
				}
			}
			return 1
		}
		return 0
	}

	function evaluateSumSub(sumList, subList, min, max) {
		if (sumList === undefined || !Array.isArray(sumList)) sumList = []
		if (subList === undefined || !Array.isArray(subList)) subList = []

		let sum = 0

		for (let i = 0; i < sumList.length; i++) {
			if (typeof sumList[i] === "number") {
				sum += sumList[i]
			} else if (sumList[i][0] === "!") {
				if (items[sumList[i].substring(1)] === undefined) console.log("unknown item:", sumList[i].substring(1))
				sum += items[sumList[i].substring(1)].curStage === 0 ? 1 : 0
			} else {
				sum += items[sumList[i]].curStage
			}
		}
		for (let i = 0; i < subList.length; i++) {
			if (typeof subList[i] === "number") {
				sum -= subList[i]
			} else {
				sum -= items[subList[i]].curStage
			}
		}
		
		if (max !== undefined && sum > max) return max
		if (min !== undefined && sum < min) return min
		return sum
	}

	let knownErrors = []
	function evaluateEntry(entry, val, debugField) {
		if (Array.isArray(entry) || typeof entry === "object") return evaluateAnd(entry, debugField)
		let item = items[entry]
		if (entry === "@") return false
		if (!item) {
			if (knownErrors.indexOf(entry) === -1) {
				console.error("undefined item description:", JSON.stringify(entry)+(val?" with value "+JSON.stringify(val):""), "in", debugField)
				knownErrors.push(entry)
			}
			return false
		}
		if (val !== undefined) {
			if (typeof val === "number") {
				return item.curStage === val
			} else if (typeof val === "boolean") {
				return item.curStage > 0
			} else if (typeof val === "string") {
				if (val === "") return item.curStage > 0
				if (val[0] === ">") {
					let valDesc = val.substring(1)
					let num = parseInt(valDesc)
					return item.curStage > (isNaN(num)?findStageForString(item, valDesc):num)
				} else if (val[0] === "<") {
					let valDesc = val.substring(1)
					let num = parseInt(valDesc)
					return item.curStage < (isNaN(num)?findStageForString(item, valDesc):num)
				} else if (val[0] === "!") {
					let valDesc = val.substring(1)
					let num = parseInt(valDesc)
					return item.curStage !== (isNaN(num)?findStageForString(item, valDesc):num)
				} else {
					return item.curStage === findStageForString(item, val)
				}
			} else if (Array.isArray(val)) {
				if (val.length === 0) return item.curStage > 0
				else return item.curStage >= val[0] && item.curStage <= val[1]
			}
		} else {
			return item.curStage > 0
		}
	}
	function findStageForString(item, stageName) {
		if (item.stages) {
			for (let i = 0; i < item.stages.length; i++) {
				if (item.stages[i].name === stageName) return i+1
			}
			console.log("stagename not found: "+stageName+" (item: "+item.basename+")")
			return getItemMinStage(item)

		} else {
			console.log("keyed stage for stageless item: "+item.basename)
			return getItemMinStage(item)
		}
	}

	function updateAllItemRender() {
		for (let itemName in items) {
			if (items[itemName].delayUpdate) {
				items[itemName].delayUpdate = false
				return
			}
			updateItemRender(items[itemName])
		}
	}
	function updateItemRender(item) {
		let itemImgs = item.imgDomRefs
		log(itemImgs)
		for(let i = 0; i < itemImgs.length; i++) {
			setImgForStage(item, itemImgs[i])
		}
		let itemTitles = item.titleDomRefs
		log(itemTitles)
		for(let i = 0; i < itemTitles.length; i++) {
			setTitleForStage(item, itemTitles[i])
		}
	}

	function checkPaths() {
		console.log("Pathing Check ...")
		let entryPoints = []
		console.log("clearing connectedToEntryPoint")
		for (let mapName in maps) {
			let map = maps[mapName]
			if (map.locations) {
				for (let locName in map.locations) {
					let loc = map.locations[locName]
					if (loc === undefined) continue
					loc.connectedToEntryPoint = false
					if (loc.entryPoint) entryPoints.push([map, loc])
				}
			}
		}
		console.log("validating...")
		for (let entryPoint of entryPoints) {
			let loc = entryPoint[1]
			checkConnections(loc)
		}
	}
	function checkConnections(loc) {
		if (!loc.connectedToEntryPoint) {
			loc.connectedToEntryPoint = true
			for (let connectionName in loc.connectsTo) {
				if (loc.connectsTo[connectionName].ref) checkConnections(loc.connectsTo[connectionName].ref)
			}
			for (let connectionName in loc.connectsOneWayTo) {
				if (loc.connectsOneWayTo[connectionName].ref) checkConnections(loc.connectsOneWayTo[connectionName].ref)
			}
		}
	}

	// 0: undecided
	//-1: unreachable
	// 1: reachable
	// 2: reachable one way

	function pathMaps() {
		let entryPoints = []
		//clear pathing
		for (let mapName in maps) {
			let map = maps[mapName]
			if (map.locations) {
				for (let locName in map.locations) {
					let loc = map.locations[locName]
					if (loc === undefined) continue
					loc.pathingStatus = 0
					if (isEntryPoint(loc)) entryPoints.push([map, loc])
				}
			}
		}
		if (debugPathing) console.log("Detected Entry Points: ", entryPoints.map(e=>e[0].basename+"::"+e[1].basename).join(",  "))
		//go forth and take the land
		for (let entryPoint of entryPoints) {
			let loc = entryPoint[1]
			if (debugPathing) console.log("starting from: ", loc.basename)
			pathCount = 0
			pathConnections(loc)
		}
		//round up the remainders
		for (let mapName in maps) {
			let map = maps[mapName]
			if (map.locations) {
				for (let locName in map.locations) {
					let loc = map.locations[locName]
					if (loc === undefined) continue
					if (loc.pathingStatus === 0) loc.pathingStatus = -1
				}
			}
		}
		debugPathing = false
	}
	function isEntryPoint(loc) {
		if (loc.entryPoint) {
			if (typeof loc.entryPoint === "boolean") {
				return loc.entryPoint
			} else {
				for (let factors of loc.entryPoint) {
					if (evaluateAnd(factors, "entryPoint of "+loc.basename)) {
						return true
					}
				}
			}
		}
		return false
	}
	
	let indent = ""
	let pathCount = 0
	function pathConnections(loc, prev, oneWay) {
		let pathDebugName
		let originalStatus
		let oneWayPropagation = false
		if (debugPathing) {
			originalStatus = loc.pathingStatus
			indent += "    "
			pathDebugName = loc.parentMapName+"::"+loc.basename
			//console.log(indent+"["+pathDebugName+"] pathing...")
		}

		if (loc.pathingStatus && (loc.pathingStatus === 1 || loc.pathingStatus === 2 && prev.pathingStatus !== 1)) {
			if (debugPathing) {
				console.log(indent+"["+pathDebugName+"]  early escape - pathingStatus: ", loc.pathingStatus, "["+(++pathCount)+"]")
				indent = indent.substring(4)
			}
			return loc.pathingStatus === 1
		}
		if (isEntryPoint(loc)) loc.pathingStatus = 1
		else if (prev && !oneWay) {
			let prevStatus = loc.pathingStatus
			loc.pathingStatus = prev.pathingStatus
			if (debugPathing) console.log(indent+"["+pathDebugName+"]  early set (connected) - pathingStatus: ", prevStatus, "->", loc.pathingStatus, "["+(++pathCount)+"]")
			if (prevStatus === 2 && loc.pathingStatus === 1) oneWayPropagation = true
		}
		else if (oneWay) {
			loc.pathingStatus = 2
			if (debugPathing) console.log(indent+"["+pathDebugName+"]  early set (one way) - pathingStatus: ", loc.pathingStatus, "["+(++pathCount)+"]")
		}

		checkTwoWayConnections(loc, indent)
		oneWayPropagation = checkOneWayConnections(loc, oneWayPropagation, indent)

		if (oneWayPropagation) {
			if (loc.connectsTo) {
				if (debugPathing) console.log(indent+"  propagate two-way connections due to one-way changes: "+Object.keys(loc.connectsTo).length, "["+(++pathCount)+"]")
				pathAllSub(loc.connectsTo, loc, indent)
			}
			if (loc.connectsOneWayTo) {
				if (debugPathing) console.log(indent+"  "+"propagate one-way connections due to one-way changes: "+Object.keys(loc.connectsOneWayTo).length, "["+(++pathCount)+"]")
				pathAllSub(loc.connectsOneWayTo, loc, indent)
			}
		}
		if (debugPathing) {
			console.log(indent+"["+loc.parentMapName+"::"+loc.basename+"] resulting pathingStatus: ", (prev?prev.pathingStatus:"x")+"/", originalStatus, "->", loc.pathingStatus, "["+(++pathCount)+"]")
			indent = indent.substring(4)
		}
		return loc.pathingStatus === 1
	}
	
	function checkTwoWayConnections(loc, indent) {
		let conCount = 0
		if (debugPathing && loc.connectsTo) console.log(indent+"  two-way connections: "+Object.keys(loc.connectsTo).length, "["+(++pathCount)+"]")
		for (let connectionName in loc.connectsTo || []) {
			let connectionData = loc.connectsTo[connectionName]
			if (connectionData.ref) {
				if (debugPathing) console.log(indent+"  "+(++conCount)+"/"+Object.keys(loc.connectsTo).length+" "+connectionData.ref.parentMapName+"::"+connectionData.ref.basename, "["+(++pathCount)+"]")
				if (connectionData.length === 0) {
					pathConnections(connectionData.ref, loc)
				} else {
					let factorsFound = false
					for (let factors of connectionData) {
						if (evaluateAnd(factors, "connectsTo "+connectionName+" of "+loc.basename)) {
							pathConnections(connectionData.ref, loc)
							factorsFound = true
							break
						}
					}
					if (debugPathing && !factorsFound) console.log(indent+"   no valid factors.", "["+(++pathCount)+"]")
				}
			} else {
				if (!connectionData._broken) {
					connectionData._broken = true
					console.warn("broken ref: from "+loc.parentMapName+"::"+loc.basename+" to "+(connectionName.indexOf("::")<0?loc.parentMapName+"::":"")+connectionName)
					
				}
			}
		}
	}
	function checkOneWayConnections(loc, oneWayPropagation, indent) {
		let conCount = 0
		if (debugPathing && loc.connectsOneWayTo) console.log(indent+"  "+"one-way connections: "+Object.keys(loc.connectsOneWayTo).length, "["+(++pathCount)+"]")
		for (let connectionName in loc.connectsOneWayTo || []) {
			if (debugPathing) console.log(indent+"  "+(++conCount)+"/"+Object.keys(loc.connectsOneWayTo).length+" "+connectionName, "["+(++pathCount)+"]")
			let connectionData = loc.connectsOneWayTo[connectionName]
			if (connectionData.ref) {
				if (connectionData.ref.pathingStatus === 1) {
					let prevStatus = loc.pathingStatus
					loc.pathingStatus = 1
					if (debugPathing) console.log(indent+"["+loc.parentMapName+"::"+loc.basename+"] set after reconnecting one way - pathingStatus: ", prevStatus, "->", loc.pathingStatus, "["+(++pathCount)+"]")
					if (prevStatus === 2 && loc.pathingStatus === 1) oneWayPropagation = true
				}
				if (connectionData.ref.pathingStatus) continue
				if (connectionData.length === 0) {
					oneWayPropagation = checkOneWayLoop(connectionData.ref, loc, indent)
				} else {
					for (let factors of connectionData) {
						if (evaluateAnd(factors, "connectsOneWayTo "+connectionName+" of "+loc.basename)) {
							oneWayPropagation = checkOneWayLoop(connectionData.ref, loc, indent)
							break
						}
					}
				}
			} else {
				if (!connectionData._broken) {
					connectionData._broken = true
					console.warn("broken ref: from "+loc.parentMapName+"::"+loc.basename+" to "+(connectionName.indexOf("::")<0?loc.parentMapName+"::":"")+connectionName)
				}
			}
		}
		return oneWayPropagation
	}

	function checkOneWayLoop(connections, loc, indent) {
		if (pathConnections(connections, loc, true)) {
			let prevStatus = loc.pathingStatus
			loc.pathingStatus = 1
			if (debugPathing) console.log(indent+"["+loc.parentMapName+"::"+loc.basename+"] set after reconnecting one way - pathingStatus: ", prevStatus, "->", loc.pathingStatus, "["+(++pathCount)+"]")
			if (prevStatus === 2 && loc.pathingStatus === 1) return true
		}
		return false
	}
	function pathAllSub(connections, loc, indent) {
		let conCount = 0
		for (let connectionName in connections) {
			let connectionData = connections[connectionName]
			if (connectionData.ref) {
				if (debugPathing) console.log(indent+"  "+(++conCount)+"/"+Object.keys(connections).length+" "+connectionData.ref.parentMapName+"::"+connectionData.ref.basename, "["+(++pathCount)+"]")
				if (connectionData.length === 0) {
					pathConnections(connectionData.ref, loc)
				} else {
					let factorsFound = false
					for (let factors of connectionData) {
						if (evaluateAnd(factors, "connectsTo "+connectionName+" of "+loc.basename)) {
							pathConnections(connectionData.ref, loc)
							factorsFound = true
							break
						}
					}
					if (debugPathing && !factorsFound) console.log(indent+"   no valid factors.", "["+(++pathCount)+"]")
				}
			}
		}
	}

	function updateAllMapData() {
		pathMaps()
		
		for (let mapName in maps) {
			let map = maps[mapName]
			if (map.locations) {
				for (let locName in map.locations) {
					let locData = map.locations[locName]
					if (locData === undefined) continue
					if (locData.items) {
						let oldItemsLeft = locData.itemsLeft
						locData.itemsLeft = 0
						for (let item of locData.items) {
							if (!evaluateEntry(item, undefined, "itemsLeft count of "+locData.basename)) locData.itemsLeft++
						}
						if (locData.pathingStatus === -1 && locData.itemsLeft < locData.items.length && oldItemsLeft !== locData.itemsLeft) {
							console.warn ("Out of logic with current items?:", locData.basename, locData)
						}
					}
				}
			}
		}

	}

	function updateAllMapRender() {
		for (let mapName in maps) {
			updateMapRender(maps[mapName])
		}
	}
	function updateMapRender(map) {
		if (map.parts) {
			for (let partName in map.parts) {
				let part = map.parts[partName]
				let mapImgs = part.domRefs
				log(mapImgs)
				for(let i = 0; i < mapImgs.length; i++) {
					setDataForMapPart(part, mapImgs[i])
				}
			}
		}
		if (map.locations) {
			for (let locName in map.locations) {
				let locData = map.locations[locName]
				if (locData === undefined) continue
				let locImgs = locData.domRefs
				for (let locImg of locImgs) {
					setDataForMapLoc(locData, locImg)
				}
			}
		}
	}

	function addTestHeader(t, parent) {
		if (!parent) parent = body
		let h1 = document.createElement("h1")
		h1.appendChild(document.createTextNode(t))
		parent.appendChild(h1)
		parent.appendChild(document.createElement("br"))
	}

	function testImages(t) {
		setTimeout(() => {
			let testImagesDiv = document.createElement("div")
			addTestHeader("Image Test", testImagesDiv)
			for(let exf in extracted) {
				if (exf.substring(0,4)==="img/" && (exf.substring(-4) === ".png" || exf.substring(-4) === ".gif" || exf.substring(-4) === ".jpg" || exf.substring(-4) === ".jpeg")) {
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
			body.appendChild(testImagesDiv)
		}, t)
	}

	function setImgForStage(item, img) {
		let isOff = !item.noOffStage && item.curStage === 0
		let imgData
		let imgBaseStyle = /*"border-radius: 50%; "+*/"user-select: none; image-rendering: crisp-edges; vertical-align: middle; "
		if (isOff) {
			imgData = item.imgOff || item.img || item.stages[0].img
			img.setAttribute("style", imgBaseStyle+/*"border: 2px solid gray; "+*/(item.imgOff?"":"filter: grayscale(100%);"))
		} else {
			imgData = item.stages && item.stages[item.curStage-1].img || item.img
			img.setAttribute("style", imgBaseStyle/*+"border: 2px solid lightgray;"*/)
		}
		if (extracted["img/"+imgData]) {
			img.setAttribute("src", extracted["img/"+imgData])
		} else {
			img.setAttribute("src", "imgerror.png")
		}
	}
	
	function setTitleForStage(item, title) {
		let isOff = !item.noOffStage && item.curStage === 0
		title.setAttribute("style", "user-select: none; color: "+(isOff?"gray":"lightgray"))
		let curName
		if (!item.name && !item.stages && item.curStage < 2) curName = item.basename
		else if (item.name && !item.stages && item.curStage < 2) {
			curName = item.name
		} else if (item.stages && item.stages[item.curStage-1] && item.stages[item.curStage-1].name) {
			curName = item.stages[item.curStage-1].name
		} else if (item.stages || item.curStage > 1) {
			if (item.name && item.name.indexOf("$$") > -1) curName = item.name
			else curName = (item.name || item.basename) + (item.curStage > 0 ?" [" + item.curStage + "]" : "")
		} else {
			curName = item.basename
		}
		title.innerHTML = renderItemName(item, curName)
	}
	function renderItemName(item, name) {
		let ret
		if (name.indexOf("$$") > -1) ret = name.replace("$$", item.curStage)
		else if (item.name && item.name.indexOf("%%") > -1) {
			if (item.curStage === 0) {
				if (item.template) {
					for (let templateName of item.template) {
						if (items["__"+templateName] && items["__"+templateName].name) {
							ret = item.name.replace("%%", items["__"+templateName].name)
							break
						}
					}
				}
				if (!ret) ret = item.name.replace("%%", "None")
			} else {
				ret = item.name.replace("%%", name)
			}
		}
		else ret = name
		return ret
	}

	function generateImageForItem(item) {
		let img = document.createElement("img")
		img.setAttribute("class", "item_img_"+item.rendername)
		setImgForStage(item, img)
		setItemClickHandler(img, item)
		if (item.imgDomRefs.indexOf(img) === -1) item.imgDomRefs.push(img)
		return img
	}
	function generateTitleForItem(item) {
		let title = document.createElement("span")
		title.setAttribute("class", "item_title_"+item.rendername)
		setTitleForStage(item, title)
		setItemClickHandler(title, item)
		if (item.titleDomRefs.indexOf(title) === -1) item.titleDomRefs.push(title)
		return title
	}
	function setItemClickHandler(node, item) {
		node.item = item
		let increment = item.increment || 1
		node.onclick = function(e) {
			if (e.altKey && e.ctrlKey) adjustStage(item, +increment*1000)
			else if (e.altKey) adjustStage(item, +increment*100)
			else if (e.ctrlKey) adjustStage(item, +increment*10)
			else adjustStage(item, +increment)
			e.preventDefault()
			return false
		}
		node.oncontextmenu = function(e) {
			if (e.altKey && e.ctrlKey) adjustStage(item, -increment*1000)
			else if (e.altKey) adjustStage(item, -increment*100)
			else if (e.ctrlKey) adjustStage(item, -increment*10)
			else adjustStage(item, -increment)
			e.preventDefault()
			return false
		}
	}
	function getCapValue(item) {
		if (item.curStage === 0) return 0
		return item.capValue ||
			(item.stages && item.stages[item.curStage-1].capValue) ||
			item.curStage
	}
	function getItemMinStage(item) {
		return item.noOffStage?1:0
	}
	function getItemMaxStage(item) {
		if (item.stages) return item.stages.length
		if (item.countable || item.countMem) {
			if (item.maxAmount) {
				if (typeof item.maxAmount === "number") return item.maxAmount
				else if (typeof item.maxAmount === "string") {
					return getCapValue(items[item.maxAmount])
				}
			} else {
				return Infinity
			}
		}
		else return 1
	}
	function adjustStage(item, increment) {
		//console.log(item.basename, ":", item.curStage, "->", item.curStage+increment)
		if (increment === 0) return
		setStage(item, item.curStage + increment)
	}
	function setStage(item, desiredStage) {
		let minStage = getItemMinStage(item)
		let maxStage = getItemMaxStage(item)

		if (desiredStage >= minStage && desiredStage <= maxStage) {
			//console.log("valid!")
			updateGameItemState(item, desiredStage)
			if (item.maxCaps) {
				for (let itemName of item.maxCaps) {
					let cappedItem = items[itemName]
					let capValue = getCapValue(item)
					if (cappedItem.curStage > capValue || item.fillOnUpgrade) {
						adjustStage(cappedItem, capValue - cappedItem.curStage)
					}
				}
			}
		} else {
			//console.log("trying to adjust")
			if (item.cycle) {
				if (desiredStage < minStage) setStage(item, maxStage)
				else if (desiredStage > maxStage) setStage(item, minStage)
			} else {
				if (desiredStage < minStage) setStage(item, minStage)
				else if (desiredStage > maxStage) setStage(item, maxStage)
			}
		}
	}
	
	function addNewValueToNewMem(memType, loc, val) {
		console.log("adding: ", memType, loc, val)
		memIndex[memType][loc] = val
		if (!newMem[memType]) newMem[memType] = []
		for (let i = 0; i < newMem[memType].length; i++) {
			if (newMem[memType][i][0] === loc) {
				newMem[memType][i][1] = val
				return
			}
		}
		newMem[memType].push([loc, val])
	}
	
	function deactivateMemEntries(mems) {
		for (let memType in mems) {
			if (Array.isArray(mems[memType])) {
				for (let memLoc of mems[memType]) {
					let oldVal = memIndex[memType][memLoc[0]]
					let newVal
					newVal = oldVal & (memLoc[1] ^ 0xFF)
					addNewValueToNewMem(memType, memLoc[0], newVal)
				}
			} else {
				console.error("nonArray found: ", mems[memType])
			}
		}
	}
	function activateMemEntries(mems) {
		for (let memType in mems) {
			if (Array.isArray(mems[memType])) {
				for (let memLoc of mems[memType]) {
					let oldVal = memIndex[memType][memLoc[0]]
					console.log(oldVal)
					let newVal
					if (memLoc[1] > 0) newVal = oldVal | memLoc[1]
					else newVal = oldVal & (memLoc[1] ^ 0xFF)
					addNewValueToNewMem(memType, memLoc[0], newVal)
				}
			} else {
				console.error("nonArray found: ", mems[memType])
			}
		}
	}
	
	function updateGameItemState(item, newStage) {
		item.delayUpdate = true
		if (item.countMem) {
			let memType = Object.keys(item.countMem)[0]
			if (item.countMap) {
				let remainder = newStage
				let countMap = item.countMap
				let countMapSorted = item.countMapSorted
				let bitMask = new Array(countMap.length)
				bitMask.fill(0)
				let byteMask = new Array(Math.ceil(countMap.length/8))
				byteMask.fill(0)
				//console.log(countMapSorted)
				//console.log(remainder)
				while(remainder > 0) {
					for (let i = 0; i < countMapSorted.length; i++) {
						//console.log("testing "+countMapSorted[i]+" against "+remainder)
						if (countMapSorted[i] <= remainder) {
							bitMask[countMap.indexOf(countMapSorted[i])] = 1
							remainder -= countMapSorted[i]
							//console.log("success!")
							break
						}
						if (i === countMapSorted.length-1) {
							remainder = 0
						}
					}
				}
				//console.log(bitMask)
				for (let i = 0; i < bitMask.length; i++) {
					if (bitMask[i] === 1) {
						byteMask[Math.floor(i/8)] = byteMask[Math.floor(i/8)] | (1 << (7-(i%8)))
					}
				}
				//console.log(byteMask)
				for (let i = 0; i < item.countMem[memType].length; i++) {
					let loc = item.countMem[memType][i]
					let baseVal = memIndex[memType][loc[0]] & item.countIgnoreMap[i]
					addNewValueToNewMem(memType, loc[0], baseVal | byteMask[i])
				}
			} else {
				let bytesAvailable = item.countMem[memType].length
				//if (newStage > Math.pow(0x100, bytesAvailable) -1) newStage = 
				for (let i = bytesAvailable-1; i >= 0; i--) {
					addNewValueToNewMem(memType, item.countMem[memType][i][0], (newStage >> (bytesAvailable-1-i)*8) & 0xFF)
				}
			}
		} else if (item.stages) {
			if (item.curStage > 0) deactivateMemEntries(item.stages[item.curStage-1].mem)
			if (newStage > 0) activateMemEntries(item.stages[newStage-1].mem)
		} else if (item.mem) {
			if (newStage === 1) activateMemEntries(item.mem)
			else deactivateMemEntries(item.mem)
		}
		if (item.forceMem) {
			activateMemEntries(item.forceMem)
		}

		//update rest
		item.curStage = newStage
		updateItemRender(item)
	}

	function testItems(t) {
		setTimeout(() => {
			let testDiv = document.createElement("div")
			addTestHeader("Item Test", testDiv)
			let itemGroups = {}
			for (let itemName in items) {
				//if (itemName.substr(0,2) === "__") continue
				let item = items[itemName]
				let groupName = item.template && item.template[item.template.length-1] || (item.basename.substring(0, 2) === "__"?"__hidden":"(no template)")
				if (["__hidden", "ring", "chest", "chestPast"].includes(groupName)) continue
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
					if (item.img || item.stages && item.stages[0].img) {
						groupDiv.appendChild(generateImageForItem(item))
						groupDiv.appendChild(document.createTextNode(" "))
					}
					groupDiv.appendChild(generateTitleForItem(item))
					groupDiv.appendChild(document.createElement("br"))
				}
				groupDiv.appendChild(document.createElement("br"))
				testDiv.appendChild(groupDiv)
			}
			body.appendChild(testDiv)
		}, t)
	}
	
	function testMaps(t) {
		setTimeout(() => {
			let testDiv = document.createElement("div")
			addTestHeader("Map Test", testDiv)
			for (let mapName in maps) {
				if (mapName.substring(0, 2) === "__") continue
				let subDiv = document.createElement("div")
				subDiv.setAttribute("style", "display:inline-block;margin:8px;")
				let h2 = document.createElement("h2")
				h2.appendChild(document.createTextNode(mapName))
				subDiv.appendChild(h2)
				subDiv.appendChild(generateImageForMap(maps[mapName]))
				testDiv.appendChild(subDiv)
			}
			body.appendChild(testDiv)
		}, t)
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
		if (typeof objXY === "string") ret = items[objXY].curStage || 0
		if (objXYFactor) ret *= objXYFactor
		if (objXYOffset) ret += objXYOffset
		
		if (objXY2 || objXY2Offset) {
			let ret2 = 0
			if (objXY2) {
				if (typeof objXY2 === "number") ret2 = objXY2
				if (typeof objXY2 === "string") ret2 = items[objXY2].curStage || 0
			}
			if (objXY2Factor) ret2 *= objXY2Factor
			if (objXY2Offset) ret2 += objXY2Offset
			ret += ret2
		}
		return ret
	}
	function getStyleXYWHV(obj) {
		let style = ""
		if (obj.x !== undefined || obj.y !== undefined) style+="position: absolute;"
		if (obj.x !== undefined) style += "left:"+getFactored(obj, "x")+"px;"
		if (obj.y !== undefined) style += "top:"+getFactored(obj, "y")+"px;"
		if (obj.width !== undefined) style += "width:"+obj.width+"px;"
		if (obj.height !== undefined) style += "height:"+obj.height+"px;"
		if (obj.visible && !evaluateAnd(obj.visible, obj.basename)) style += "visibility: hidden;"
		return style
	}
	
	function setDataForMapPart(partData, img) {
		if (partData.imgStage) img.setAttribute("src", extracted["img/"+partData.img[items[partData.imgStage].curStage]])
		else img.setAttribute("src", extracted["img/"+partData.img])
		let style = "image-rendering:crisp-edges;"
		style += getStyleXYWHV(partData)
		img.setAttribute("style", style)
	}
	
	let pathValues = {"-1":"unreachable", 0:"unknown", 1:"reachable", 2:"oneway trip"}
	function setDataForMapLoc(locData, img) {
		let style = "image-rendering:crisp-edges;"
		style += getStyleXYWHV(locData)
		if (locData.pathingStatus === -1) {
			let imgData = locData.imgOff || locData.img
			if (imgData) img.setAttribute("src", extracted["img/"+imgData])
			else img.setAttribute("src", "imgerror.png")
			if (!locData.imgOff) style += "filter: grayscale(66%);"
		}else if (locData.pathingStatus === 1 && !locData.itemsLeft) {
			let imgData = locData.img
			if (imgData) img.setAttribute("src", extracted["img/"+imgData])
			else img.setAttribute("src", "imgerror.png")
			style += "filter: grayscale(100%);"
		} else if (locData.pathingStatus > 0) {
			let imgData = locData.img
			if (imgData) img.setAttribute("src", extracted["img/"+imgData])
			else img.setAttribute("src", "imgerror.png")
		}
		if (!showEverything && (locData.pathingStatus < 1 || !locData.itemsLeft)) style += "visibility: hidden;"
		img.setAttribute(
			"title",
			locData.basename +
				" ("+pathValues[locData.pathingStatus] +
				(locData.items?", "+locData.itemsLeft+"/"+locData.items.length+" items left":"")+")\n"+
				locData.conDesc
		)
		img.setAttribute("style", style)
	}

	function createLine(x, y, x2, y2, classString) {
		let baseStyle = "position:absolute;background:black;height:2px;"
		let lineDiv = document.createElement("div")
		let xDiff = x2 - x
		let yDiff = y2 - y
		let len = Math.sqrt(Math.pow(xDiff,2) + Math.pow(yDiff,2))
		let angle = Math.atan2(yDiff, xDiff) / Math.PI * 180
		let renderX = x + xDiff/2 - len/2;
		let renderY = y - 1 + yDiff/2
		lineDiv.setAttribute("style", baseStyle+"width:"+len+"px;left:"+renderX+"px;top:"+renderY+"px;transform:rotate("+angle+"deg);")
		lineDiv.setAttribute("class", "map_line "+classString)
		//console.log("creating line: ", [x, y], [x2, y2], [renderX, renderY], len, angle, classString, lineDiv)
		return lineDiv
	}
	
	function generateLineData(locData, connectionAttribute, parent) {
		let locName = locData.basename
		if (!locData.hasLine) locData.hasLine = {}
		for (let conName in locData[connectionAttribute]) {
			let conRef = locData[connectionAttribute][conName] && locData[connectionAttribute][conName].ref
			if (conRef === undefined) console.warn("no ref?", locData.basename, connectionAttribute, conName)
			let nameOrder = [locData.rendername, conRef.rendername].sort()
			let connectionClassName = "map_line_"+nameOrder[0]+"__"+nameOrder[1]
			if (conRef && !conRef.hasLine) conRef.hasLine = {}
			if (conRef && conName.indexOf("::") === -1 && !conRef.hasLine[locName]) {
				let lineDiv = createLine(
					getFactored(locData, "x") + (locData.width?locData.width/2:0),
					getFactored(locData, "y") + (locData.height?locData.height/2:0),
					getFactored(conRef, "x") + (conRef.width?conRef.width/2:0),
					getFactored(conRef, "y") + (conRef.width?conRef.width/2:0),
					connectionClassName
				)
				let titleString = locData.basename+" -- "+conRef.basename+"\n"
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
	
	function generateConDesc(locData, attribute) {
		return Object.keys(locData[attribute])
			.map(e => e + (
				locData[attribute][e].length>0?
					" -- "+JSON.stringify(locData[attribute][e]):
					""
			)).join("\n    ")
	}
	function generateImageForMap(map) {
		let mapDiv = document.createElement("div")
		mapDiv.setAttribute("style", "position: relative; display: inline-block; overflow: hidden")
		mapDiv.setAttribute("class", "__mapFrame")
		if (map.parts) {
			for (let mapPart in map.parts) {
				let partData = map.parts[mapPart]
				if (partData.top) continue
				let mapImgElement = document.createElement("img")
				mapImgElement.setAttribute("class", "map_img_"+map.rendername+"__"+partData.rendername)
				setDataForMapPart(partData, mapImgElement)
				partData.domRefs.push(mapImgElement)
				mapDiv.appendChild(mapImgElement)
			}
		}
		
		if (map.locations) {
			for (let locName in map.locations) {
				let locData = map.locations[locName]
				if (locData === undefined) continue
				if (locData.connectsTo) {
					console.log(locName)
					console.log(locData)
					generateLineData(locData, "connectsTo", mapDiv)
					generateLineData(locData, "connectsOneWayTo", mapDiv)
				}
				if (locData.img) {
					let locElement = document.createElement("img")
					locElement.setAttribute("class", "map_location map_img_"+map.rendername+"__"+locData.rendername)
					locData.conDesc =  (locData.connectsTo?"connects to:\n    "+generateConDesc(locData, "connectsTo")+"\n":"")+
						(locData.connectsOneWayTo?"connects oneway to:\n    " + generateConDesc(locData, "connectsOneWayTo")+"\n":"") +
						(locData.connectsOneWayFrom?"connects oneway from:\n    " + generateConDesc(locData, "connectsOneWayFrom"):"")

					setDataForMapLoc(locData, locElement)
					locData.domRefs.push(locElement)
					mapDiv.appendChild(locElement)
				}
			}
		}
		if (map.parts) {
			for (let mapPart in map.parts) {
				let partData = map.parts[mapPart]
				if (!partData.top) continue
				let mapImgElement = document.createElement("img")
				mapImgElement.setAttribute("class", "map_img_"+map.rendername+"__"+partData.rendername)
				setDataForMapPart(partData, mapImgElement)
				partData.domRefs.push(mapImgElement)
				mapDiv.appendChild(mapImgElement)
			}
		}
		return mapDiv
	}
}

export { PL };

/*
63C: room ID on current level


C3A: current dungeon room

C35: BG music?
c39: level?
c3F: level?

TODO: dungeon shuffle, pollspeed, checkable, hardmode, eval loop (instant update of canRemoveBushes/etc. make an array of all items and iterate and skip until you can't no more)
*/