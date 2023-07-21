export function applyBaseRendername(obj) {
	for (let key in obj) {
		let entry = obj[key]
		if (entry === undefined) continue
		entry.basename = key
		entry.rendername = key.replace(/ /g, "_")
	}
}

function cloneObj(obj) {
	try {
		return JSON.parse(JSON.stringify(obj))
	} catch (e) {
		console.error("could not clone obj: ", obj)
		throw e
	}
}

export function applyTemplates(obj, templateSource, type) {
	if (!templateSource) templateSource = obj
	for (let key in obj) {
		let entry = obj[key]
		if (entry === undefined) continue
		if (entry.t) entry.template = entry.t
		if (!entry.template) continue
		if (typeof entry.template === "string") entry.template = [entry.template]
		for (let templateName of entry.template) {
			let template = templateSource[templateName]
			if (!template) {
				console.error("no template found for key: ", templateName)
				console.log("templateSource: ", templateSource)
			}
			if (template.template) entry.template = [...entry.template, ...template.template]
			for (let tKey in template) {
				if (entry[tKey] === undefined) {
					entry[tKey] = cloneObj(template[tKey])
				}
			}
			if (type === "item") {
				applyItemMemTemplate(entry, templateSource, templateName)
			}
		}
	}
}
function applyTemplateToFlag(template, flag) {
	if (!flag[0] && template?.[0]) {
		flag[0] = template[0]
	}
	if (!flag[1] && template?.[1]) {
		flag[1] = template[1]
	}
}

function generateStagesFromTemplate(entry, template) {
	let entryMem = entry["mem"]
	delete entry["mem"]
	entry.stages = JSON.parse(JSON.stringify(template.stages))
	for (let stage of entry.stages) {
		let stageMem = stage["mem"]
		for (let memType in stageMem) {
			for (let i = 0; i < stageMem[memType].length; i++) {
				applyTemplateToFlag(entryMem?.[memType]?.[i], stageMem[memType][i])
			}
		}
	}
}

function fillStagesFromTemplate(entry) {
	for (let stageIndex = 0; stageIndex < entry.stages.length; stageIndex++) {
		let entryMem = entry["mem"] || []
		let stageMem = entry.stages[stageIndex]["mem"] || []

		for (let memType in stageMem) {
			let entryMemType = entryMem[memType]
			let stageMemType = stageMem[memType]
			for (let i = 0; i < stageMemType.length; i++) {
				applyTemplateToFlag(entryMemType?.[i], stageMemType[i])
			}
			if (entryMemType?.length > stageMemType.length) {
				for (let i = stageMemType.length; i < entryMemType.length; i++) {
					stageMemType.push(entryMemType[i])
				}
			}
		}

		for (let memType in entryMem) {
			stageMem[memType] ||= entryMem[memType]
		}
	}
}

function applyMemTemplate(entry, templateSource, memKey, memType) {
	let entryMemTypeData = entry[memKey][memType]
	for (let i = 0; i < entryMemTypeData.length; i++) {
		for (let innerTemplateName of entry.template || []) {
			applyTemplateToFlag(templateSource[innerTemplateName]?.[memKey]?.[memType]?.[i], entryMemTypeData[i])
		}
	}
}

function applyItemMemTemplate(entry, templateSource, templateName) {
	let template = templateSource[templateName]

	if(!entry.stages && template.stages && entry["mem"]) {
		generateStagesFromTemplate(entry, template)
	}
	if (entry.stages) {
		fillStagesFromTemplate(entry)
	}

	// regular mem
	for (let memKey of ["mem", "countMem", "forceMem"]) {
		for (let memType in entry[memKey]) {
			applyMemTemplate(entry, templateSource, memKey, memType)
		}
	}
}
