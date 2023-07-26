import jsyaml from "../../lib/js-yaml.min.js";

export function formatPerc(a,b) {
	return Math.round(a/b*10000)/100+"%"
}

export function Utf8ArrayToStr(array) {
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

export function utf8ArrayToYaml(array) {
	let yamlStr = Utf8ArrayToStr(array).replace(/\t/g, " "); //lol yaml
	return jsyaml.safeLoad(yamlStr)
}

//do not worry dear, we are magically fixing everything that is naturally wrong with you. (a.k.a. your parents were like "lol what json spec")
export function cleanJSON(str) {
	return str
		.replace(/^\uFEFF/, "") //remove BOM
		.replace(/(\r\n)/g, "\n") //convert newlines
		.replace(/\/\/.*?\n/g, "\n") //drop line comments
		.replace(/\/\*(.|\n)*?\*\//g, "") //drop block comments
		.replace(/,\s*?(?=[}\],])/g, "") //drop double/trailing commas
}

export function removeAllChildren(node) {
	while (node.firstChild) {
		removeAllChildren(node.firstChild)
		node.removeChild(node.firstChild)
	}
}

export function parseIntString(n) {
	let ret = null
	if (typeof n === "string") {
		let numString = n
		if (n[0] === "-") numString = n.substring(1)
		if (numString.startsWith("0b")) ret = parseInt(numString.substring(2), 2)
		else if (numString.startsWith("0o")) ret = parseInt(numString.substring(2), 8)
		else if (numString.startsWith("0x")) ret = parseInt(numString.substring(2), 16)
		else ret = parseInt(numString, 16)
		ret *=  ((n[0] === "-")?-1:1)
	} else if (typeof n === "number") {
		ret = n
	}
	if (ret === null || Number.isNaN(ret)) throw `invalid numeric type: ${n}`
	else return ret
}

export function isSocketOpen(socket) {
	return socket?.readyState === socket.OPEN
}

let logPackLoader = false
export function log(msg) {
	if (logPackLoader) console.log(msg)
}