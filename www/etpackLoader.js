let etpl = new function etpl () {
	function formatPerc(a,b) {
		return Math.round(a/b*10000)/100+"%";
	}

	let extracted;
	let filesMeta;
	let currentExtracted;
	let filesTotal;
	let currentSizeExtracted;
	let fileSizeTotal;
	let dlStart;
	let exStart;

	let items;
	let itemsIndex;

	function Utf8ArrayToStr(array) {
		var out, i, len, c;
		var char2, char3;
		out = "";
		len = array.length;
		i = 0;
		while(i < len) {
			c = array[i++];
			switch(c >> 4) {
			  case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
				// 0xxxxxxx
				out += String.fromCharCode(c);
				break;
			  case 12: case 13:
				// 110x xxxx   10xx xxxx
				char2 = array[i++];
				out += String.fromCharCode(
					((c & 0x1F) << 6) |
					(char2 & 0x3F)
				);
				break;
			  case 14:
				// 1110 xxxx  10xx xxxx  10xx xxxx
				char2 = array[i++];
				char3 = array[i++];
				out += String.fromCharCode(
					((c & 0x0F) << 12) |
					((char2 & 0x3F) << 6) |
					((char3 & 0x3F) << 0)
				);
				break;
			}
		}
		return out;
	}

	function utf8ArrayToJson(array) {
		let jsonStr = cleanJSON(Utf8ArrayToStr(array));
		return JSON.parse(jsonStr);
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
		extracted = {};
		var request = new XMLHttpRequest();
		request.responseType = 'blob';
		request.addEventListener("progress", e => {
			let perc = formatPerc(e.loaded,e.total);
			//console.log(perc+" downloaded");
			dl.innerHTML = perc+((e.loaded/e.total === 1)?" (in "+((new Date())-dlStart)/1000+"s)":"");
			dlpb.style.width = perc;
		});
		request.addEventListener("readystatechange", e => {
			if (request.readyState === 2 && request.status === 200) {
				console.log("started DL...");
			} else if (request.readyState === 3) {
				//console.log("in progress...");
			} else if (request.readyState === 4) {
				console.log("DL finished!");
				console.log("content:");
				console.log(request.response);
				unpack(request.response);
			}
		});
		request.open("get", url);
		dlStart = new Date();
		request.send();
	}
	this.loadPack = loadPack;

	function unpack(blob) {
		var zip = new JSZip();
		zip.loadAsync(blob).then(zipData => {
			console.log("zip loaded, data:");
			console.log(zipData);
			filesMeta = zipData.files;
			let count = 0;
			filesTotal = Object.keys(filesMeta).length;
			currentExtracted = 0;
			
			fileSizeTotal = 0;
			currentSizeExtracted = 0;
			for (file in filesMeta) {
				if (filesMeta[file]._data && filesMeta[file]._data.uncompressedSize) {
					fileSizeTotal += filesMeta[file]._data.uncompressedSize;
				}
			}
			console.log("total size: "+fileSizeTotal);
			exStart = new Date();
			for (file in filesMeta) {
				if (!filesMeta[file].dir) {
					(f =>
						zipData.file(f).async("uint8array").then(data => {
							extracted[f] = data;
							currentSizeExtracted += data.length;
							currentExtracted++;
							checkExtractDone();
						}))(file);
				} else {
					currentExtracted++;
					checkExtractDone();
				}
			}
		})
	}

	function checkExtractDone() {
		/*let perc = formatPerc(currentExtracted,filesTotal);
		console.log(perc+" extracted");
		ex.innerHTML = perc;
		expb.style.width = perc;*/

		let perc2 = formatPerc(currentSizeExtracted,fileSizeTotal);
		//console.log(perc2+" size extracted");
		ex2.innerHTML = perc2+((currentSizeExtracted/fileSizeTotal === 1)?" (in "+((new Date())-exStart)/1000+"s)":"");
		ex2pb.style.width = perc2;

		if (currentExtracted === filesTotal) {
			console.log("done extracting...");
			//console.log(extracted);
			preConversion();
		}
	}

	function preConversion() {
		Object.keys(extracted).forEach(key => {
			let fileData = extracted[key];
			if (key.substr(-4) === ".png" && fileData[1] === 0x50 && fileData[2] === 0x4E && fileData[3] === 0x47) {
				extracted[key] = "data:image/png;base64, "+bytesToBase64(fileData);
			}
			else if (key.substr(-4) === ".gif" && fileData[0] === 0x47 && fileData[1] === 0x49 && fileData[2] === 0x46 && fileData[3] === 0x38 && fileData[5] === 0x61) {
				extracted[key] = "data:image/gif;base64, "+bytesToBase64(fileData);
			}
			else if ((key.substr(-4) === ".jpg" || key.substr(-4) === ".jpeg") && fileData[0] === 0xFF && fileData[1] === 0xD8 && fileData[2] === 0xFF) {
				extracted[key] = "data:image/jpeg;base64, "+bytesToBase64(fileData);
			}
			else if (key.substr(-5) === ".json") {
				try {
					extracted[key] = utf8ArrayToJson(fileData);
				} catch(e) {
					console.log("JSON parsing failed:");
					console.log(e);
					console.log("data of "+key+":");
					console.log(cleanJSON(Utf8ArrayToStr(fileData)).split("\n"));
				}

			}
		});
		console.log("done preconversion, starting pack...");
		//console.log(extracted);
		startPack();
	}

	function startPack() {
		initLua();
		loadItems();

		testBroadcast(100);
		testItems(200);
		testImages(300);
	}

	function loadItems() {
		items = extracted["items.json"];
		itemsIndex = {};
		for(item of items) {
			let codes;
			if (item.type === "toggle" || item.type === "consumable") {
				codes = item.codes.split(/\s*,\s*/g);
			} else if (item.type === "progressive" && item.stages) {
				codes = [];
				for (let i = 0; i < item.stages.length; i++) {
					let stage = item.stages[i];
					if (stage.codes) {
						codes = codes.concat(stage.codes.split(/\s*,\s*/g));
					}
				}
			} else {
				console.warn("unknown item type: "+item.type);
				continue;
			}
			codes.forEach(code => itemsIndex[code] = item);
		}
	}

	function addBroadcast(parent) {
		let bcData = extracted["broadcast_layout.json"];
		renderLayout(bcData, parent, 4);
	}

	function marginToCss(data) {
		let marginData = data.split(/\s*,\s*/g);
		return "margin:"+marginData[1]+"px "+marginData[2]+"px "+marginData[3]+"px "+marginData[0]+"px;";
	}

	function renderLayout(data, parent, arrayDepth) {
		if (data.type === "array") {
			let vertical = data.orientation === "vertical";
			if (!vertical && data.orientation !== "horizontal") {
				console.warn("unknown orientation: "+data.orientation);
			}

			for(let i = 0; i < data.content.length; i++) {
				let entry = data.content[i];
				let block = document.createElement("div");
				if (vertical) {
					block.setAttribute("class", "layoutBlock layoutVertBlock");
				} else {
					block.setAttribute("class", "layoutBlock layoutHorzBlock");
				}
				let styleData = "";
				if (entry.h_alignment) {
					styleData+="text-align:center;";
				}
				if (entry.margin) {
					styleData+=marginToCss(entry.margin);
				} else if (arrayDepth) {
					styleData+="margin:"+[0,0,0,4,4][arrayDepth]+"px;";
				}
				if(styleData) {
					block.setAttribute("style", styleData);
				}
				
				parent.appendChild(block);
				if (entry.type) {
					renderLayout(entry, block, arrayDepth?arrayDepth-1:0);
				}
			}
		} else if (data.type === "itemgrid") {
			let gridBlock = document.createElement("div");
			if (data.margin) {
				gridBlock.setAttribute("style", marginToCss(data.margin));
			}
			for(let i = 0; i < data.rows.length; i++) {
				let row = data.rows[i];
				let rowBlock = document.createElement("div");
				rowBlock.setAttribute("class", "layoutBlock layoutVertBlock");
				if (data.h_alignment && data.h_alignment === "center") {
					rowBlock.setAttribute("style","text-align: center;");
				}
				for(let j = 0; j < row.length; j++) {
					let entry = row[j];
					let entryBlock = document.createElement("div");
					entryBlock.setAttribute("class", "layoutBlock itemgridBlock layoutHorzBlock");
					let styleData="";
					if (data.item_size && typeof data.item_size === "number") {
						styleData+="width:"+data.item_size+"px;height:"+data.item_size+"px;";
					}
					if (data.item_margin) {
						styleData+=marginToCss(data.item_margin);
					}
					if (styleData) {
						entryBlock.setAttribute("style", styleData);
					}

					if (entry) {
						let itemData = itemsIndex[entry];
						let img = document.createElement("img");
						if (!itemData) {
							console.warn("unknown item for layout: "+entry);
						}
						if (itemData.type === "progressive") {
							img.setAttribute("src", extracted[itemData.stages[0].img]);
						} else {
							img.setAttribute("src", extracted[itemData.img]);
						}
						if (styleData) {
							img.setAttribute("style", "width:100%;height:100%;")
						}
						entryBlock.appendChild(img);
					}

					rowBlock.appendChild(entryBlock);
				}
				
				gridBlock.appendChild(rowBlock);
			}
			parent.appendChild(gridBlock);
		} else if (data.type === "item") {
			let entryBlock = document.createElement("div");
			entryBlock.setAttribute("class", "layoutBlock layoutHorzBlock");
			let styleData="";
			if (data.width && typeof data.width === "number") {
				styleData+="width:"+data.width+"px;";
			}
			if (data.height && typeof data.height === "number") {
				styleData+="height:"+data.height+"px;";
			}
			if (styleData) {
				entryBlock.setAttribute("style", styleData);
			}
			
			if (data.item) {
				let img = document.createElement("img");
				let itemData = itemsIndex[data.item];
				if (!itemData) {
					console.warn("unknown item for layout: "+data.item);
				}
				if (itemData.type === "progressive") {
					img.setAttribute("src", extracted[itemData.stages[0].img]);
				} else {
					img.setAttribute("src", extracted[itemData.img]);
				}
				if (styleData) {
					img.setAttribute("style", "width:100%;height:100%;")
				}
				entryBlock.appendChild(img);
			}

			parent.appendChild(entryBlock);
		} else {
			console.warn("unknown layout type: "+data.type);
		}
	}

	function addTestHeader(t) {
		body.appendChild(document.createElement("br"));
		body.appendChild(document.createElement("br"));
		body.appendChild(document.createElement("br"));
		body.appendChild(document.createElement("br"));
		let h1 = document.createElement("h1");
		h1.appendChild(document.createTextNode(t));
		body.appendChild(h1);
		body.appendChild(document.createElement("br"));
		body.appendChild(document.createElement("br"));
	}

	function testImages(t) {
		setTimeout(() => {
			addTestHeader("Image Test");
			for(exf in extracted) {
				if (exf.substr(0,7)==="images/" && (exf.substr(-4) === ".png" || exf.substr(-4) === ".gif" || exf.substr(-4) === ".jpg" || exf.substr(-4) === ".jpeg")) {
					let newImg = document.createElement("img");
					newImg.setAttribute("src", extracted[exf]);
					newImg.setAttribute("width", "32px");
					newImg.setAttribute("style", "image-rendering: crisp-edges;");
					body.appendChild(newImg);
				}
			}
		}, t);
	}

	function testItems(t) {
		setTimeout(() => {
			addTestHeader("Item Test");
			for(item of items) {
				body.appendChild(document.createTextNode(item.name+" ("+item.type+")"));
				body.appendChild(document.createElement("br"));
				if (item.type === "toggle" || item.type === "consumable") {
					let img = document.createElement("img");
					img.setAttribute("src", extracted[item.img]);
					img.setAttribute("style", "border: 2px solid gray;");
					body.appendChild(img);
					body.appendChild(document.createTextNode(" "));
					body.appendChild(document.createTextNode(item.codes));
				} else if (item.type === "progressive" && item.stages) {
					for (let i = 0; i < item.stages.length; i++) {
						let stage = item.stages[i];
						let img = document.createElement("img");
						img.setAttribute("src", extracted[stage.img]);
						img.setAttribute("style", "border: 2px solid gray;");
						body.appendChild(img);
						body.appendChild(document.createTextNode(" "));
						body.appendChild(document.createTextNode(stage.codes?stage.codes:i));
						body.appendChild(document.createElement("br"));
					}
				} else {
					console.warn("unknown item type: "+item.type);
				}
				body.appendChild(document.createElement("br"));
				body.appendChild(document.createElement("br"));
			}
		}, t);
	}

	function testBroadcast(t) {
		setTimeout(() => {
			addTestHeader("Broadcast Layout Test");
			let frame = document.createElement("div");
			frame.setAttribute("style", "border: 2px solid green; display: inline-block; padding: 1px;");
			body.appendChild(frame);
			addBroadcast(frame);
		}, t);
	}
}