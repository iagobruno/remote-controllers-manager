import io from 'socket.io'
import { applyRCMMiddlewareOnSocketIOServer } from '../src/server'
import { green, blue } from 'colors'
const server = io.listen(3000)

applyRCMMiddlewareOnSocketIOServer(server, {
  ifMasterControllerDisconnects: 'passToNext',
  maxConnectedControllers: 3,
})

console.log(green('⚡ Listening on port http://localhost:3000'))
