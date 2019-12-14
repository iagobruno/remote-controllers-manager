const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const { applyRCMMiddleware } = require('remote-controllers-manager/server')
const { resolve } = require('path')
const { green, blue } = require('colors')

applyRCMMiddleware(io, {
  allowMultipleRooms: true,
  maxControllersPerRoom: 3,
  ifMasterControllerDisconnects: 'passToNext',
})

app.use(express.static('public'))

app.get('/client.umd.js', (req, res) => 
  res.sendFile(resolve(__dirname, '..', '..', 'dist', 'client.umd.js'))
)

const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(green(`⚡ Listening on port http://localhost:${port}`))
})
