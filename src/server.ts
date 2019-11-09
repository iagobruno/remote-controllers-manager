import { Socket, Server as IOServerType } from 'socket.io'

interface ServerOptions {
  /** @default Infinity */
  maxConnectedControllers?: number;
  /** @default true */
  needsAMasterController?: boolean;
  /** @default "waitHimReconnect" */
  ifMasterControllerDisconnects?: 'passToNext' | 'waitHimReconnect';
  // TODO: allowMultipleRooms?: boolean; // https://socket.io/docs/rooms-and-namespaces/#Rooms
  // TODO: allowMultipleScreensPerRoom?: boolean;
}

/**
 * @example
 * import io from 'socket.io'
 * import { applyRCMMiddlewareOnSocketIOServer } from 'remote-controllers-manager'
 *
 * const server = io.listen(3000)
 * applyRCMMiddlewareOnSocketIOServer(server)
 */
export function applyRCMMiddlewareOnSocketIOServer(io: IOServerType, options?: ServerOptions) {
  const defaultOptions: ServerOptions = {
    maxConnectedControllers: Infinity,
    needsAMasterController: true,
    ifMasterControllerDisconnects: 'waitHimReconnect',
  }
  options = Object.assign(defaultOptions, options)

  let screen: Socket | null = null
  const controllers = new Map<string, Socket>()
  let masterControllerId: string | null = null

  // Validate new connections
  io.use((socket, next) => {
    const { deviceKind, deviceId } = socket.handshake.query

    if (deviceKind === undefined || typeof deviceKind !== 'string') {
      return next(new Error('Invalid or not set "deviceKind".'))
    }

    if (deviceKind === 'screen' && screen !== null) {
      return next(new Error('There is already a screen connected.'))
    }

    if (deviceKind === 'controller') {
      if (controllers.size >= options?.maxConnectedControllers!) {
        return next(new Error('Maximum number of connected controllers was reached.'))
      }
      if (deviceId === undefined || typeof deviceId !== 'string') {
        return next(new Error('Invalid or not set "deviceId".'))
      }
      if (controllers.has(deviceId)) {
        return next(new Error('This controller is already connected.'))
      }
    }

    // Allow access
    next()
  })

  io.on('connection', (socket) => {
    const { deviceKind, deviceId } = socket.handshake.query

    if (deviceKind === 'screen') {
      screen = socket
      socket.emit('__all_connected_controllers_id', Array.from(controllers.keys()) )
      // Notify all controllers
      controllers.forEach((control) => control.emit('__screen_connected'))
    }
    else if (deviceKind === 'controller') {
      controllers.set(deviceId, socket)
      socket.emit('__screen_is_connected', screen !== null)
      // If it's the first controller to connect, set it as the master
      if (options?.needsAMasterController === true && masterControllerId === null) {
        masterControllerId = deviceId
        io.emit('__master_controller_id_changed', masterControllerId)
      }
      screen?.emit('__new_controller', deviceId)
    }
    socket.emit('__master_controller_id', masterControllerId)

    socket.on('broadcast', ({ data, exceptFor }) => {
      controllers.forEach((controllerSocket, controllerId) => {
        if (exceptFor && controllerId === exceptFor) return;
        controllerSocket.emit('message', data, deviceId)
      })
    })

    socket.on('sendTo', ({ recipientDevice, data }) => {
      if (recipientDevice === 'screen') {
        return screen?.emit('message', data, deviceId)
      }

      const device = controllers.get(recipientDevice)
      device?.emit('message', data, deviceId)
    })

    socket.on('disconnect', () => {
      if (deviceKind === 'screen') {
        screen = null
        controllers.forEach((control) => {
          control.emit('__screen_disconnect')
        })
      }
      else if (deviceKind === 'controller') {
        controllers.delete(deviceId)
        screen?.emit('__controller_disconnect', deviceId)

        // what to do when master controller disconnects
        if (deviceId === masterControllerId && options?.needsAMasterController) {
          if (options?.ifMasterControllerDisconnects === 'passToNext') {
            masterControllerId = controllers.keys().next().value ?? null
            io?.emit('__master_controller_id_changed', masterControllerId)
          }
          else if (options?.ifMasterControllerDisconnects === 'waitHimReconnect') { /* do nothing */ }
        }
      }
    })
  })
}
