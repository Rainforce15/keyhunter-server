let timeAvgLen = 128

let avgTimers = {}
let timers = {}

export function avgTimeAction(action, timer) {
	if (!avgTimers[timer]) avgTimers[timer] = []
	let history = avgTimers[timer]
	let startTime = new Date()
	action()
	history.unshift(new Date() - startTime)
	if (history.length > timeAvgLen) history.pop()
	return Math.round((history.reduce((sum,cur) => sum + cur)/history.length)*100)/100
}

export function setTimer(timer) {
	timers[timer] = new Date()
}

export function getTimer(timer) {
	return new Date() - timers[timer]
}