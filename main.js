const fs = require('fs')
const mimes = require('mime-types')
const webRoot = "./www"
const cacheTTL = 1000
const port = 19272
const tcp_port = 19273
let net = require("net")
let WebSocket = require("ws")

const webserver = require('http').createServer(handler)
const ws = new WebSocket.Server({server: webserver})
ws.on("connection", wsHandler)
webserver.listen(port)

console.log("started up webserver on port "+port)
console.log("listening to connector on port "+tcp_port)

const cache = {}; // {data, timestamp, mime}; cached html responses

function handler(req, res) {
	let [baseUrl, query] = req.url.split("?")

	let webFilePath = baseUrl
	let now = Date.now()

	webFilePath = webRoot + webFilePath.replace(/\/\.\./g, "")

	let cachedFile = cache[req.url]
	if(cachedFile && now - cacheTTL < cachedFile.timestamp) {
		returnData(res, 200, cachedFile.data, cachedFile.mime)
	} else {
		try {
			if (fs.lstatSync(webFilePath).isDirectory()) {
				if (baseUrl[baseUrl.length-1] !== "/") {
					res.writeHead(302, {"Location": baseUrl+"/"+(query?"?"+"query":"")})
					res.end()
					return
				} else {
					webFilePath+="/index.html"
				}
			}
		} catch(e) {
			console.log("Invalid Path: "+baseUrl+" ("+(e && e.code)+")")
			returnData(res, 500, '500: Invalid')
			return
		}
		fs.readFile(webFilePath,
			function (err, data) {
				if (err) {
					console.log(err.code)
					console.log("error reading file:")
					console.log(err)
					returnData(res, 500, '500: Invalid')
				} else {
					let mime = mimes.lookup(webFilePath)
					cache[req.url] = {
						data: data,
						timestamp: now,
						mime: mime
					}
					returnData(res, 200, data, mime)
				}
			}
		)
	}
}

function returnData(res, code, data, mime) {
	res.setHeader('Access-Control-Allow-Origin', '*')
	if (mime) {
		res.writeHead(code, {"Content-Type": mime, "Content-Length": data.length})
	} else {
		res.writeHead(code)
	}
	res.end(data)
}

function wsHandler(socket) {
	console.log("new connection")

	socket.on("close", () => console.log("ws closed."))
	socket.on("error", e => console.log("ws error: ", e))

	if(socket.protocol === "memReading") {
		console.log("new memReader")
		socket.on("message", msg => {
			serverConnections.forEach(netSock => {
				if (!netSock.destroyed){
					netSock.write(msg+"\r\n")
				}
			})
		})
	}
}

let serverConnections = []

let server = net.createServer(function(socket) {
	console.log("new client: "+socket.remoteAddress)
	if (serverConnections.indexOf(socket) === -1) serverConnections.push(socket)
	//setInterval(()=>{socket.write(JSON.stringify({o:"read_u8", a:0x0739, d:"WRAM"})+"\r\n");}, 1500)
	socket.on("data", function(data) {
		data = data.toString()
		ws.clients.forEach(socket => {if(socket.protocol === "memReading") data.trim().split("\r\n").forEach(d => socket.send(d))})
	})

	socket.on("close", e=>{
		console.log("disconnected: "+socket.remoteAddress)
	})

	socket.on("error", e=>{
		if (e.code === "ECONNRESET") {
			console.log(socket.remoteAddress+": ECONNRESET (that's ok, methinks)")
		} else {
			console.log(socket.remoteAddress+": socket error:")
			console.log(e)
		}
	})
})

server.listen(tcp_port)


