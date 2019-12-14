import * as io from 'socket.io'
import { applyRCMMiddleware } from 'remote-controllers-manager/server'
import { green, blue } from 'colors'
const server = io.listen(3000)

applyRCMMiddleware(server, {
  allowMultipleRooms: true,
  maxControllersPerRoom: 3,
  ifMasterControllerDisconnects: 'passToNext',
})

console.log(green('⚡ Listening on port http://localhost:3000'))