import {extracted} from "./packLoader.js";
import * as base from "./base.js";
import * as memory from "./memory.js";
import {updateItemRender} from "./itemsRender.js";

export let elements = {}

function fixMemArray(mem) {
	if (mem) for (let memType in mem) {
		if (Array.isArray(mem[memType]) && !Array.isArray(mem[memType][0])) {
			mem[memType] = [mem[memType]]
		}
	}
}

function fixMemArrayShortcuts() {
	for (let itemName in elements) {
		let item = elements[itemName]
		for (let memKey of ["mem", "countMem", "forceMem"]) {
			fixMemArray(item[memKey])
		}
		if (item.stages) {
			for (let stage of item.stages) {
				fixMemArray(stage["mem"])
			}
		}
	}
}

function buildCountIgnoreMap(item) {
	let itemCountMap = item["countMap"]
	if (itemCountMap) {
		item.countMapSorted = JSON.parse(JSON.stringify(itemCountMap)).sort((a, b) => b - a)
		let countIgnoreMap = []
		item.countIgnoreMap = countIgnoreMap
		for (let i = 0; i < itemCountMap.length; i++) {
			if (i % 8 === 0) {
				countIgnoreMap.push(0)
			}
			if (itemCountMap[i] === 0) {
				countIgnoreMap[countIgnoreMap.length - 1] |= [0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01][i % 8]
			}
		}
	}
}

function buildMaxCaps(item) {
	let itemMaxAmount = item["maxAmount"]
	if (itemMaxAmount && typeof itemMaxAmount === "string") {
		if (!elements[itemMaxAmount].maxCaps) {
			elements[itemMaxAmount].maxCaps = []
		}
		elements[itemMaxAmount].maxCaps.push(item.basename)
	}
}

function parseAllMemAndIndex(item, groupDistance) {
	if (item.stages) {
		for (let stage of item.stages) {
			memory.parseAllFlagsAndIndex(stage["mem"], groupDistance)
		}
	}
	for (let memKey of ["mem", "countMem", "forceMem"]) {
		memory.parseAllFlagsAndIndex(item[memKey], groupDistance)
	}
}

function parseItemMemStringsAndIndex(groupDistance) {
	fixMemArrayShortcuts()
	base.applyTemplates(elements, elements, "item")
	for (let itemName in elements) {
		let item = elements[itemName]
		//if (itemName.substr(0, 2) === "__") continue
		buildCountIgnoreMap(item)
		buildMaxCaps(item)

		item.curStage = item["noOffStage"] ? 1 : 0

		parseAllMemAndIndex(item, groupDistance)
	}
	//final group test pass
	memory.spliceGroups(groupDistance)
}

function initDomRefs() {
	for (let itemName in elements) {
		elements[itemName].imgDomRefs = []
		elements[itemName].titleDomRefs = []
	}
}

export function load(groupDistance) {
	elements = extracted["items.yaml"] || extracted["items.json"]
	if (!elements) {
		console.error("no item.yaml/json definition.")
		return
	}
	console.log("loading items...")
	console.log(elements)
	for (let itemName in elements) {
		if (!elements[itemName]) elements[itemName] = {}
	}
	base.applyBaseRendername(elements)
	base.applyTemplates(elements)
	parseItemMemStringsAndIndex(groupDistance)
	initDomRefs()
	memory.sendAndReceiveState()
	setInterval(memory.sendAndReceiveState, 1000)
	wsListeners.push(memory.addressHandler)
	console.log("done")
}

export function updateAllItemData() {
	for (let itemName in elements) {
		updateItemData(elements[itemName])
	}
}
function evaluateStage(stage, debugField) {
	if (stage["mem"]) return memory.evaluateFlags(stage["mem"])
	else if (stage["or"]) return evaluateOr(stage["or"], debugField)
	else if (stage["nor"]) return !evaluateOr(stage["nor"], debugField)
	else if (stage["and"]) return evaluateAnd(stage["and"], debugField)
	else if (stage["sum"] || stage["sub"]) return evaluateSumSub(stage["sum"], stage["sub"], stage["minAmount"], stage["maxAmount"])
}

function raiseCurStageToHighestValid(item) {
	item.curStage = item["noOffStage"]?1:0
	let itemStages = item["stages"]
	for (let i = 0; i < itemStages.length; i++) {
		let stageData = itemStages[i]
		let stageNumber = i + 1
		if (evaluateStage(stageData, item.basename) && item.curStage < stageNumber) {
			item.curStage = stageNumber
		}
	}
}

function raiseCurStageToCounted(item) {
	let itemCountMem = item["countMem"]
	let memType = Object.keys(itemCountMem)[0]
	let locMemIndex = memory.memIndex[memType]
	let memForType = itemCountMem[memType]
	item.curStage = 0
	for(let i = 0; i < memForType.length; i++) {
		let val = locMemIndex[memForType[i][0]]
		if (item["countMap"]) {
			let offset = 8 * i
			for (let j = 0; j < 8; j++) {
				if (((val << j) & 0x80) === 0x80) {
					item.curStage += item["countMap"][offset + j]
				}
			}
		} else {
			let newStage = item.curStage + val * Math.pow(0x100, (memForType.length - 1 - i))
			if (item.forceMax && item.forceMax < newStage) {
				newStage = item.forceMax
			}
			item.curStage = newStage
		}
	}
}

function updateItemData(item) {
	if (item["stages"]) {
		raiseCurStageToHighestValid(item)
	} else if (item["countMem"]) {
		raiseCurStageToCounted(item)
	} else {
		item.curStage = evaluateStage(item, item.basename)
	}
}
function evaluateOr(orList, debugField) {
	if (Array.isArray(orList)) {
		for (let orElement of orList) {
			if (evaluateEntry(orElement, undefined, debugField)) return 1
		}
	} else if(typeof orList === "object") {
		for (let orElement in orList) {
			if (evaluateEntry(orElement, orList[orElement], debugField)) return 1
		}
	}
	return 0
}
export function evaluateAnd(andList, debugField) {
	if (Array.isArray(andList)) {
		for (let andElement of andList) {
			if (!evaluateEntry(andElement, undefined, debugField)) return 0
		}
	} else if(typeof andList === "object") {
		for (let andElement in andList) {
			if (andElement === "or") {
				if (!evaluateOr(andList[andElement], debugField)) return 0
			} else {
				if (!evaluateEntry(andElement, andList[andElement], debugField)) return 0
			}
		}
	}
	return 1
}

function getSumSubStage(sumtrahend) {
	if (typeof sumtrahend === "number") {
		return sumtrahend
	} else {
		return elements[sumtrahend].curStage
	}
}

function evaluateSumSub(sumList, subList, min, max) {
	if (sumList === undefined) sumList = []
	if (subList === undefined) subList = []
	if (!Array.isArray(sumList)) sumList = [sumList]
	if (!Array.isArray(subList)) subList = [subList]

	let sum = 0

	for (let summand of sumList) {
		sum += getSumSubStage(summand)
	}
	for (let subtrahend of subList) {
		sum -= getSumSubStage(subtrahend)
	}

	if (max !== undefined) {
		max = getSumSubStage(max)
		if (sum > max) return max
	}
	if (min !== undefined) {
		min = getSumSubStage(min)
		if (sum < min) return min
	}

	return sum
}
let knownErrors = []

function findStageForString(item, stageName) {
	if (item.stages) {
		for (let i = 0; i < item.stages.length; i++) {
			if (item.stages[i].name === stageName) return i + 1
		}
		console.log(`stageName not found: ${stageName} (item: ${item.basename})`)
	} else {
		console.log(`keyed stage for stageless item: ${item.basename}`)
	}
	return item["noOffStage"] ? 1 : 0
}

function getCompStage(item, val) {
	let valDesc = val.substring(1)
	let num = parseInt(valDesc)
	return isNaN(num) ? findStageForString(item, valDesc) : num
}

export function evaluateEntry(entry, val, debugField) {
	if (Array.isArray(entry) || typeof entry === "object") return evaluateAnd(entry, debugField)
	let item = elements[entry]
	if (entry === "@") return false
	if (!item) {
		if (knownErrors.indexOf(entry) === -1) {
			console.error("undefined item description:", JSON.stringify(entry)+(val?` with value ${JSON.stringify(val)}`:""), "in", debugField)
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
				return item.curStage > getCompStage(item, val)
			} else if (val[0] === "<") {
				return item.curStage < getCompStage(item, val)
			} else if (val[0] === "!") {
				return item.curStage !== getCompStage(item, val)
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

function getCapValue(item) {
	if (item.curStage === 0) return 0
	return item["capValue"] ||
		item.stages && item.stages[item.curStage - 1]["capValue"] ||
		item.curStage
}

function getItemMaxStage(item) {
	if (item.stages) return item.stages.length
	if (item["countable"] || item["countMem"]) {
		let itemMaxAmount = item["maxAmount"]
		if (itemMaxAmount) {
			if (typeof itemMaxAmount === "number") {
				return itemMaxAmount
			}
			else if (typeof itemMaxAmount === "string") {
				return getCapValue(elements[itemMaxAmount])
			}
		} else {
			return Infinity
		}
	}
	else return 1
}
export function adjustStage(item, increment) {
	if (increment === 0) return
	setStage(item, item.curStage + increment)
}

function setStage(item, desiredStage) {
	let minStage = item["noOffStage"] ? 1 : 0
	let maxStage = getItemMaxStage(item)

	if (desiredStage >= minStage && desiredStage <= maxStage) {
		updateGameItemState(item, desiredStage)
		if (item.maxCaps) {
			for (let itemName of item.maxCaps) {
				let cappedItem = elements[itemName]
				let capValue = getCapValue(item)
				if (cappedItem.curStage > capValue || item["fillOnUpgrade"]) {
					adjustStage(cappedItem, capValue - cappedItem.curStage)
				}
			}
		}
	} else {
		if (item["cycle"]) {
			if (desiredStage < minStage) setStage(item, maxStage)
			else if (desiredStage > maxStage) setStage(item, minStage)
		} else {
			if (desiredStage < minStage) setStage(item, minStage)
			else if (desiredStage > maxStage) setStage(item, maxStage)
		}
	}
}

function resolveCountMapToNewMem(item, newStage) {
	let remainder = newStage
	let itemCountMem = item["countMem"]
	let countMap = item["countMap"]
	let memType = Object.keys(itemCountMem)[0]
	let countMapSorted = item.countMapSorted
	let bitMask = Array(countMap.length).fill(0)
	let byteMask = Array(Math.ceil(countMap.length / 8)).fill(0)
	while(remainder > 0) {
		for (let i = 0; i < countMapSorted.length; i++) {
			if (countMapSorted[i] <= remainder) {
				bitMask[countMap.indexOf(countMapSorted[i])] = 1
				remainder -= countMapSorted[i]
				break
			}
			if (i === countMapSorted.length-1) {
				remainder = 0
			}
		}
	}
	for (let i = 0; i < bitMask.length; i++) {
		if (bitMask[i] === 1) {
			let iBase = Math.floor(i / 8)
			byteMask[iBase] |= (1 << (7 - (i % 8)))
		}
	}
	for (let i = 0; i < itemCountMem[memType].length; i++) {
		let loc = itemCountMem[memType][i]
		let baseVal = memory.memIndex[memType][loc[0]] & item.countIgnoreMap[i]
		memory.addNewValueToNewMem(memType, loc[0], baseVal | byteMask[i])
	}
}

function updateGameItemState(item, newStage) {
	item.delayUpdate = true
	let itemCountMem = item["countMem"]
	if (itemCountMem) {
		let memType = Object.keys(itemCountMem)[0]
		if (item["countMap"]) {
			resolveCountMapToNewMem(item, newStage)
		} else {
			let bytesAvailable = itemCountMem[memType].length
			for (let i = bytesAvailable-1; i >= 0; i--) {
				memory.addNewValueToNewMem(memType, itemCountMem[memType][i][0], (newStage >> (bytesAvailable - 1 - i) * 8) & 0xFF)
			}
		}
	} else if (item.stages) {
		if (item.curStage > 0) memory.deactivateMemEntries(item.stages[item.curStage - 1]["mem"])
		if (newStage > 0) memory.activateMemEntries(item.stages[newStage - 1]["mem"])
	} else if (item["mem"]) {
		if (newStage === 1) memory.activateMemEntries(item["mem"])
		else memory.deactivateMemEntries(item["mem"])
	}
	if (item["forceMem"]) {
		memory.activateMemEntries(item["forceMem"])
	}

	//update rest
	item.curStage = newStage
	updateItemRender(item)
}

function getTemplateName(item) {
	for (let templateRef of item.template) {
		let template = elements[`__${templateRef}`]
		if (template?.name) {
			return template.name
		}
	}
}

export function getItemName(item) {
	let name = item.name || getTemplateName(item) || item.basename
	let curStage = item.curStage
	let curStageName = item.stages?.[curStage - 1]?.name

	if (name.includes("%%")) {
		name = name.replaceAll("%%", curStage > 0 ? curStageName : "None")
	} else {
		if (curStageName) {
			name = curStageName
		}else if (curStage > 1 && !name.includes("$$")) {
			name = `${name} [${curStage}]`
		}

		name = name.replaceAll("$$", curStage)
	}

	return name;
}