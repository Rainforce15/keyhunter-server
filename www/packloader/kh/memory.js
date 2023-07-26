import * as util from "./util.js";

export let memIndex = {}
let newMem = {}
let memGroups = {}
//  ..[[]] [[]] [[]]..


function addToMemGroups(memType, address, groupdistance) {
	util.log("memGroups so far:", JSON.stringify(memGroups))
	util.log("adding ", address)
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
export function parseAllFlagsAndIndex(mem, groupdistance) {
	if (mem) {
		for (let memType in mem) {
			let memList = mem[memType]
			if (memList.or) memList = memList.or
			for (let i = 0; i < memList.length; i++) {
				parseFlagAndIndex(memList[i], memType, groupdistance)
			}
		}
	}
}
function parseFlagAndIndex(flag, memType, groupdistance) {
	flag[0] = (flag[0] !== "" && flag[0] !== null && flag[0] !== undefined)?util.parseIntString(flag[0]):""
	if (flag[1]) flag[1] = util.parseIntString(flag[1])

	if (flag[0] !== "" && (flag[1] === undefined || flag[1] !== "")) {
		if (!memIndex[memType]) memIndex[memType] = {}
		memIndex[memType][flag[0]] = 0
		addToMemGroups(memType, flag[0], groupdistance)
	}
}
export function spliceGroups(groupdistance) {
	for (let memType in memGroups) {
		let group = memGroups[memType]
		for (let i = 0; i < group.length - 1; i++) {
			if (i > 0 && group[i-1][1] >= group[i][0] - groupdistance) {
				if (group[i-1][1] < group[i][1]) group[i-1][1] = group[i][1]
				group.splice(i, 1)
				i--
			}
		}
	}
}
export function evaluateFlags(memData) {
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
			flag?.[0] &&
			flag?.[1] && (
				flag[1] > 0 && (memIndex[memType][flag[0]] & flag[1]) === flag[1] ||
				flag[1] < 0 && (memIndex[memType][flag[0]] & (-flag[1])) === 0
			)
		) {
			return true
		}
	}
	return false
}
export function addressHandler(msg) {
	let parsedMsg
	try {
		parsedMsg = JSON.parse(msg.data)
	} catch (e) {
		console.error(e)
		console.error(`JSON: ${msg.data}`)
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
export function addNewValueToNewMem(memType, loc, val) {
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
export function deactivateMemEntries(mems) {
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
export function activateMemEntries(mems) {
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
export function sendAndReceiveState() {
	sendState()
	newMem = {}
	receiveState()
}
function sendState() {
	for (let memType in newMem) {
		console.log(`type: ${memType}`, newMem)
		for (let memLoc of newMem[memType]) {
			//console.log("sending:", JSON.stringify({o:"write_u8", a:memLoc[0], v:memLoc[1], d:memType}))
			let payload = JSON.stringify({o:"write_u8", a:memLoc[0], v:memLoc[1], d:memType})
			console.log(`payload: ${payload}`)
			if (util.isSocketOpen(socket)) socket.send(payload)
		}
	}
}
function receiveState() {
	for (let memType in memGroups) {
		let group = memGroups[memType]
		for(let i = 0; i < group.length; i++) {
			let payload = JSON.stringify({o:"readbyterange", l:group[i][1] - group[i][0] + 1, a:group[i][0], d:memType})
			if (util.isSocketOpen(socket)) socket.send(payload)
		}
	}
}
