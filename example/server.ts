import io from 'socket.io'
import { applyRCMMiddleware } from '../src/server'
import { green, blue } from 'colors'
const server = io.listen(3000)

applyRCMMiddleware(server, {
  ifMasterControllerDisconnects: 'passToNext',
  maxConnectedControllers: 3,
})

console.log(green('⚡ Listening on port http://localhost:3000'))
