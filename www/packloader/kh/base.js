export function applyBaseRendername(obj) {
	for (let key in obj) {
		let entry = obj[key]
		if (entry === undefined) continue
		entry.basename = key
		entry.rendername = key.replace(/ /g, "_")
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
								if (oldMem?.[memType]?.[i]?.[0]) flag[0] = oldMem[memType][i][0]
								if (oldMem?.[memType]?.[i]?.[1]) flag[1] = oldMem[memType][i][1]
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
										if (!flag[0] && entry.mem?.[memType]?.[flagIndex]?.[0]) {
											flag[0] = entry.mem[memType][flagIndex][0]
										}
										if (!flag[1] && entry.mem?.[memType]?.[flagIndex]?.[1]) {
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
									let innerTemplate = templateSource[innerTemplateName]
									if (innerTemplate) {
										if (!flag[0] && innerTemplate[memKey]?.[memType]?.[flagIndex]?.[0]) {
											flag[0] = innerTemplate[memKey][memType][flagIndex][0]
										}
										if (!flag[1] && innerTemplate[memKey]?.[memType]?.[flagIndex]?.[1]) {
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