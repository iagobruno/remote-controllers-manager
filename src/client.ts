import * as io from 'socket.io-client'
import cuid from 'cuid'

type SocketIOConnectOpts = Parameters<typeof io.connect>[0]

type Options = SocketIOConnectOpts & {
  uri: string,
  io: typeof io,
}

type DeviceOptions = ControllerOptions & ScreenOptions

abstract class Device {
  /**
   * Stable unique ID that represents this device.
   */
  public deviceId?: string

  /**
   * If null, means that has been configured on the server that does not require a master controller.
   * @warning Can only be used after connection has been established because it's value is fetched asynchronous.
   */
  public masterControllerId: string | null | undefined = undefined

  private handleMasterControllerIdChange?: Function

  /** Instance of socket.io-client to be reused. */
  public socket: SocketIOClient.Socket

  constructor(
    private kind: 'screen' | 'controller',
    { io, uri, query, deviceId, ...options }: DeviceOptions
  ) {
    this.socket = io.connect(uri, {
      ...options,
      query: {
        ...query,
        deviceKind: this.kind,
        deviceId: this.deviceId,
      },
      autoConnect: false,
    })

    const updateMasterControllerId = (masterDeviceId: string) => {
      this.masterControllerId = masterDeviceId
      // @ts-ignore
      if (this.kind === 'controller') this.isMaster = (this.deviceId === masterDeviceId)
    }
    this.socket.once('__master_controller_id', (resMasterCId: string) => {
      updateMasterControllerId(resMasterCId)
      // @ts-ignore Defined in each subclass
      this.checkIsReady()
    })
    this.socket.on('__master_controller_id_changed', (newMasterCId: string) => {
      updateMasterControllerId(newMasterCId)
      this.handleMasterControllerIdChange?.call(undefined)
    })
  }

  /** Indicates if the API is ready to use.  */
  public isReady: boolean = false
  protected onReadyHandler?: Function

  /** Whether or not the socket is connected to the server. */
  get isConnected () {
    return this.socket.connected
  }

  protected connectionPromise (): Promise<void> {
    if (this.isConnected) return Promise.resolve()

    return new Promise<void>((resolve, reject) => {
      const handleConnect = () => {
        removeListeners()
        resolve()
      }
      const handleError = (err) => {
        this.socket.disconnect()
        removeListeners()
        reject(err)
      }
      const removeListeners = () => {
        this.socket.off('connect', handleConnect)
        this.socket.off('error', handleError)
      }

      this.socket.once('connect', handleConnect)
      this.socket.once('error', handleError)
    })
  }

  /**
   * Get called when this device disconnects and reconnects to server.
   * @returns A function to remove the listener.
   */
  onDeviceConnectionStateChanged (callback: (state: boolean) => void): UnsubscribeFunction {
    const handler = () => {
      callback(this.socket.connected)
    }
    this.socket.on('connect', handler)
    this.socket.on('disconnect', handler)
    handler()

    return () => {
      this.socket.off('connect', handler)
      this.socket.off('disconnect', handler)
    }
  }

  /**
   * Get called when the server sets another controller as the master.
   * @returns A function to remove the listener.
   */
  onMasterControllerIdChanged (callback: Function): UnsubscribeFunction {
    this.handleMasterControllerIdChange = callback

    return () => {
      this.handleMasterControllerIdChange = undefined
    }
  }

  /**
   * Send a command to master controller.
   */
  sendToMasterController<D = any> (data: D) {
    if (!this.masterControllerId) return

    this.socket.emit('sendTo', {
      recipientDevice: this.masterControllerId,
      data,
    })
  }

  /**
   * Get called when a new command arrives from another device.
   * @returns A function to remove the listener.
   */
  onMessage<D = any> (
    callback: (data: D, fromDeviceId: string) => void
  ): UnsubscribeFunction {
    this.socket.on('message', callback)

    return () => {
      this.socket.off('message', callback)
    }
  }
}


interface ScreenOptions extends Options { }

export class Screen extends Device {
  private connectedControllers: Set<string> | null = null

  constructor(options: ScreenOptions) {
    super('screen', options)

    this.socket.on('__screen_device_id', (roomId: string) => {
      this.deviceId = roomId
      this.socket.io.opts.query = Object.assign(this.socket.io.opts.query, {
        deviceId: roomId,
      })
      this.checkIsReady()
    })
    this.socket.once('__all_connected_controllers_id', (ids: string[]) => {
      this.connectedControllers = new Set(ids)
      this.checkIsReady()
    })
    this.onConnect((deviceId) => {
      this.connectedControllers?.add(deviceId)
    })
    this.onDisconnect((deviceId) => {
      this.connectedControllers?.delete(deviceId)
    })

    this.socket.once('connect', this.checkIsReady.bind(this))
  }

  /**
   * Start connection.
   * @returns A promise to indicate if the connection was successful.
   */
  public start (): Promise<void> {
    if (this.isConnected) return Promise.resolve()

    this.socket.connect()

    return this.connectionPromise()
      .then(() => new Promise<void>(resolve => {
        if (this.isReady) return resolve()
        this.onReadyHandler = resolve
      }))
  }

  private checkIsReady () {
    if (this.isReady) return
    if (
      this.connectedControllers !== null &&
      this.masterControllerId !== undefined &&
      this.socket.connected === true &&
      this.deviceId !== undefined
    ) {
      this.isReady = true
      this.onReadyHandler?.call(undefined)
    }
  }

  /**
   * @returns An array with the id of all connected controllers.
   * @warning Can only be used after "start" function because it's value is fetched asynchronous.
   */
  getAllControllerDeviceIds () {
    return Array.from(this.connectedControllers?.values()!)
  }

  /**
   * @warning Can only be used after "start" function because it's value is fetched asynchronous.
   */
  get totalOfConnectedControllers () {
    return this.connectedControllers?.size
  }

  /**
   * Gets called when a controller connects.
   * @returns A function to remove the listener.
   */
  onConnect (callback: (deviceId: string) => void): UnsubscribeFunction {
    this.socket.on('__new_controller', callback)

    return () => {
      this.socket.off('__new_controller', callback)
    }
  }

  /**
   * Gets called when a controller disconnects.
   * @returns A function to remove the listener.
   */
  onDisconnect (callback: (deviceId: string) => void): UnsubscribeFunction {
    this.socket.on('__controller_disconnect', callback)

    return () => {
      this.socket.off('__controller_disconnect', callback)
    }
  }

  /**
   * Send a command to all connected controllers.
   */
  broadcastToControllers<D = any> (data: D) {
    this.socket.emit('broadcast', { data })
  }

  /**
   * Send a command to a specific controller.
   */
  sendToController<D = any> (deviceId: string, data: D) {
    this.socket.emit('sendTo', {
      recipientDevice: deviceId,
      data
    })
  }
}


interface ControllerOptions extends Options { }

export class Controller extends Device {
  /**
   * @warning Can only be used after "connectToScreen" function because it's value is fetched asynchronous.
   */
  public isMaster: boolean | null = null

  /** Id of screen which is connected to. */
  public screenId: string | null = null

  /** 
   * @warning Can only be used after "connectToScreen" function because it's value is fetched asynchronous.
   */
  public isScreenConnected: boolean | null = null

  private handleScreenConnectionChange?: Function

  constructor(options: ControllerOptions) {
    super('controller', options as any)
    this.deviceId = getDeviceId()

    this.socket.io.opts.query = Object.assign(this.socket.io.opts.query, {
      deviceId: this.deviceId
    })

    this.socket.once('__screen_is_connected', (res) => {
      this.isScreenConnected = res
      this.checkIsReady()
    })

    this.socket.on('__screen_connected', () => {
      this.isScreenConnected = true
      this.handleScreenConnectionChange?.call(undefined, this.isScreenConnected)
    })
    this.socket.on('__screen_disconnect', () => {
      this.isScreenConnected = false
      this.handleScreenConnectionChange?.call(undefined, this.isScreenConnected)
    })

    this.socket.once('connect', this.checkIsReady.bind(this))
  }

  /**
   * Start connection.
   * @param screenId Indicates which screen the control should connect to. User must manually enter the ID that can be shown on the screen.
   * @returns A promise to indicate if the connection was successful.
   */
  public connectToScreen (screenId: string): Promise<any> {
    if (this.isConnected) return Promise.resolve()

    this.socket.io.opts.query = Object.assign(this.socket.io.opts.query, {
      roomIdToConnect: screenId
    })
    this.socket.connect()

    return this.connectionPromise()
      .then(() => {
        this.screenId = screenId
      })
      .then(() => new Promise<void>(resolve => {
        if (this.isReady) return resolve()
        this.onReadyHandler = resolve
      }))
  }

  private checkIsReady () {
    if (this.isReady) return
    if (
      this.masterControllerId !== undefined &&
      this.isMaster !== null &&
      this.isScreenConnected !== null &&
      this.socket.connected === true
    ) {
      this.isReady = true
      this.onReadyHandler?.call(undefined)
    }
  }

  /**
   * Notify when the screen disconnects or reconnects from the server.
   * @returns A function to remove the listener.
   *
   * @example
   * controller.onScreenConnectionStateChanged(isConnected => {
   *   // ...
   * })
   */
  onScreenConnectionStateChanged (callback: (state: boolean) => void): UnsubscribeFunction {
    this.handleScreenConnectionChange = callback

    return () => {
      this.handleScreenConnectionChange = undefined
    }
  }

  /**
   * Send a command to screen.
   */
  sendToScreen<D = any> (data: D) {
    this.socket.emit('sendTo', {
      recipientDevice: 'screen',
      data,
    })
  }

  /**
   * @experimental I don't know if this function is useful or if it opens security vulnerabilities.
   *
   * Send a command to all other connected controls except this one.
   */
  unsafe_broadcastToOtherControllers<D = any> (data: D) {
    this.socket.emit('broadcast', {
      exceptFor: this.deviceId,
      data,
    })
  }

  /**
   * @experimental I don't know if this function is useful or if it opens security vulnerabilities.
   *
   * Send a command to another specific controller.
   */
  unsafe_sendToAnotherController<D = any> (deviceId: string, data: D) {
    this.socket.emit('sendTo', {
      recipientDevice: deviceId,
      data,
    })
  }
}

type UnsubscribeFunction = () => void


function getDeviceId () {
  const savedDeviceId = localStorage.getItem('uq_device_id')
  if (savedDeviceId) return savedDeviceId

  const newDeviceId = cuid()
  localStorage.setItem('uq_device_id', newDeviceId)
  return newDeviceId
}
