let wsListeners = []
let socket

function connect() {
	let socket_internal = new WebSocket("ws://"+window.location.host+"/", "memReading")
	socket = socket_internal
	socket_internal.onopen = () => console.log("ws open.")
	socket_internal.onclose = () => {
		console.log("ws closed.")
		resetConnection(3000)
	}
	socket_internal.onerror = e => {
		console.log("ws error: ", e)
		socket.close()
	}
	socket_internal.onmessage = msg => wsListeners.forEach(f => f(msg))
}

function resetConnection(timeout) {
	if (socket != null) {
		socket.close()
		socket = null
	}
	console.log(`retrying in ${timeout/1000}s...`)
	setTimeout(connect, timeout)
}

connect()
