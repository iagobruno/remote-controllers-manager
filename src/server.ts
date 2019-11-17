import { Socket, Server as IOServerType } from 'socket.io'

interface ServerOptions {
  /**
   * If true, the server can create several distinct rooms, if false, only one room can be created.
   * @default true
   */
  allowMultipleRooms: boolean;
  /**
   * Self explanatory. Indicates the limit of simultaneously connected controllers per room.
   * @default Infinity
   */
  maxControllersPerRoom: number;
  /**
   * Self explanatory. Indicates the limit of simultaneously connected devices to the server.
   * Use this to prevent the server from becoming overloaded.
   * @default Infinity
   */
  limitOfConnectionsToServer: number;
  /**
   * A master controller is a controller that can change room settings, execute sensitive commands or finish the game for example.
   * @default true
   */
  eachRoomNeedsAMasterController: boolean;
  /**
   * What should happen if a room master controller disconnects.
   * @default "waitReconnect"
   */
  ifMasterControllerDisconnects: 'passToNext' | 'waitReconnect';
}

const defaultOptions: ServerOptions = {
  allowMultipleRooms: true,
  maxControllersPerRoom: Infinity,
  eachRoomNeedsAMasterController: true,
  ifMasterControllerDisconnects: 'waitReconnect',
  limitOfConnectionsToServer: Infinity,
}

let rooms: Record<RoomID, Room> = {}
let numberOfDevicesConnected = 0

/**
 * @example
 * import io from 'socket.io'
 * import { applyRCMMiddleware } from 'remote-controllers-manager'
 *
 * const server = io.listen(3000)
 * applyRCMMiddleware(server)
 */
export function applyRCMMiddleware(io: IOServerType, inputOptions?: Partial<ServerOptions>) {
  if (io === undefined || (io.emit === undefined && io.sockets === undefined)) {
    throw new Error('You must call the "applyRCMMiddleware" function with an instance of a socket.io server as the first argument.');
  }

  const options = Object.assign(defaultOptions, inputOptions)

  // Validate ne connections
  io.use((socket, next) => {
    const { deviceKind, deviceId, roomIdToConnect } = socket.handshake.query as HandshakeQuery

    if (numberOfDevicesConnected >= options.limitOfConnectionsToServer) {
      return next(new Error('The limit of devices connected to the server has been reached.'))
    }

    if (deviceKind === undefined || typeof deviceKind !== 'string') return next(new Error('Invalid or not set "deviceKind".'))
    if (deviceId === undefined || typeof deviceId !== 'string') return next(new Error('Invalid or not set "deviceId".'))

    if (deviceKind === 'screen') {
      if (
        options.allowMultipleRooms === false &&
        Object.keys(rooms).length >= 1 &&
        Object.keys(rooms)[0] !== deviceId
      ) {
        return next(new Error('The limit of rooms in the server has been reached.'))
      }
      if ((rooms[deviceId]?.screenSocket ?? null) !== null) {
        return next(new Error('There is already a screen connected to this room.'))
      }
    }

    if (deviceKind === 'controller') {
      if (roomIdToConnect === undefined) {
        return next(new Error('You must specify the room id you want to connect to.'))
      }
      const room = rooms[roomIdToConnect]
      if (!room) {
        return next(new Error('This room doesn’t exist.'))
      }

      if (room.controllers.length >= options.maxControllersPerRoom) {
        return next(new Error('The limit of connected controllers per room has been reached.'))
      }
      if (room.controllers.find(ctrl => ctrl.deviceId === deviceId) !== undefined) {
        return next(new Error('This controller is already connected in this room.'))
      }
    }

    // Allow access
    next()
  })

  io.on('connection', (socket) => {
    numberOfDevicesConnected++
    const { deviceKind, deviceId, roomIdToConnect } = socket.handshake.query as HandshakeQuery
    /** Instance of room the device connected to. */
    let room: Room;

    if (deviceKind === 'screen') {
      room = findOrCreateRoom(deviceId)

      room.screenSocket = socket
      room.screenSocket.emit('__all_connected_controllers_id', room.controllers.map(ctrl => ctrl.deviceId))
      // Notify all controllers in this room
      room.controllers.forEach((ctrl) => ctrl.socket.emit('__screen_connected'))
    }
    else if (deviceKind === 'controller') {
      room = rooms[roomIdToConnect!]

      room.screenSocket?.emit('__new_controller', deviceId)
      room.controllers.push({
        // @ts-ignore
        deviceId,
        socket: socket
      })
      socket.emit('__screen_is_connected', room.screenSocket !== null)
      // If it's the first controller to connect, set it as the master
      if (options?.eachRoomNeedsAMasterController && room.masterControllerDeviceId === null) {
        room.masterControllerDeviceId = deviceId!
        // Notify all devices in this room about the new master controller
        sendMessageToAllDevicesInTheRoom(room, room.masterControllerDeviceId)
      }
    }
    socket.emit('__master_controller_id', room!.masterControllerDeviceId)

    socket.on('broadcast', ({ data, exceptFor }) => {
      room.controllers.forEach((ctrl) => {
        if (exceptFor && ctrl.deviceId === exceptFor) return;
        ctrl.socket.emit('message', data, deviceId)
      })
    })

    socket.on('sendTo', ({ recipientDevice, data }) => {
      if (recipientDevice === 'screen') {
        room.screenSocket?.emit('message', data, deviceId)
        return;
      }
      if (recipientDevice === 'master_controller') {
        recipientDevice = room.masterControllerDeviceId
      }

      const device = room.controllers.find(ctrl => ctrl.deviceId === recipientDevice)
      device?.socket.emit('message', data, deviceId)
    })

    socket.on('disconnect', () => {
      numberOfDevicesConnected--

      if (deviceKind === 'screen') {
        room.screenSocket = null
        room.controllers.forEach((ctrl) => {
          ctrl.socket.emit('__screen_disconnect')
        })
      }
      else if (deviceKind === 'controller') {
        room.controllers = room.controllers.filter(ctrl => ctrl.deviceId !== deviceId)
        room.screenSocket?.emit('__controller_disconnect', deviceId)

        // What to do when master controller disconnects
        if (deviceId === room.masterControllerDeviceId && options.eachRoomNeedsAMasterController) {
          if (options.ifMasterControllerDisconnects === 'waitReconnect') {
            /* do nothing */
          }
          else if (options.ifMasterControllerDisconnects === 'passToNext') {
            room.masterControllerDeviceId = room.controllers[0]?.deviceId ?? null
            // Notify all devices in this room about the new master controller
            sendMessageToAllDevicesInTheRoom(room, room.masterControllerDeviceId)
          }
        }
      }

      checkIfCanDeleteTheRoom(room)
    })
  })
}


interface HandshakeQuery {
  deviceKind: 'screen' | 'controller',
  deviceId: string,
  /** Only controllers need to issue this information. */
  roomIdToConnect?: string,
}

interface Room {
  ID: RoomID,
  screenSocket: Socket | null,
  masterControllerDeviceId: string | null,
  controllers: Array<{
    deviceId: string,
    socket: Socket,
  }>
}
type RoomID = string

function findOrCreateRoom(ID: RoomID): Room {
  const roomAlreadyCreated = rooms[ID] !== undefined
  if (roomAlreadyCreated) return rooms[ID]

  const newRoom: Room = {
    ID,
    screenSocket: null,
    masterControllerDeviceId: null,
    controllers: [],
  }
  rooms[ID] = newRoom
  return newRoom
}

/** It's like the garbage collector. It checks if there is at least one device connected to the room, if not, the room is removed. */
function checkIfCanDeleteTheRoom(room: Room | string) {
  if (typeof room === 'string') room = rooms[room]

  const numberOfDevices = room.controllers.length + (room.screenSocket === null ? 0 : 1)
  if (numberOfDevices === 0) {
    delete rooms[room.ID];
  }
}

function sendMessageToAllDevicesInTheRoom(room: Room | string, data: any) {
  if (typeof room === 'string') room = rooms[room]

  room.screenSocket?.emit('__master_controller_id_changed', data)
  room.controllers.forEach(ctrl => {
    ctrl.socket.emit('__master_controller_id_changed', data)
  })
}
