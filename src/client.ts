import io from 'socket.io-client'

interface DefaultOptions {
  url: string;
  autoConnect?: boolean;
}

const defaultOptions: Omit<DefaultOptions, 'url'> = {
  autoConnect: true,
}

type DeviceOptions = ControllerOptions & ScreenOptions

class Device {
  /** Stable unique ID that represents this device. */
  public deviceId?: string;
  /**
   * If null, means that has been configured on the server that does not require a master controller.
   * @warning Can only be used within the "onReady" function because it's value is fetched asynchronous.
   */
  public masterControllerDeviceId: string | null | undefined = undefined;
  private handlerMasterControllerIdChange?: Function;
  /** Instance of socket.io-client to be reused. */
  public socket: SocketIOClient.Socket;

  constructor(
    private kind: 'screen' | 'controller',
    options: DeviceOptions
  ) {
    options = Object.assign(defaultOptions, options)

    this.deviceId = (this.kind === 'screen') ? 'screen' : options.deviceId ?? this.generateDeviceId()
    this.socket = io(options.url, {
      autoConnect: options.autoConnect,
      query: {
        deviceKind: this.kind,
        deviceId: this.deviceId,
      }
    })

    const updateMasterControllerId = (masterDeviceId: string) => {
      if (this.kind === 'controller') {
        // @ts-ignore
        this.isMasterController = (this.deviceId === masterDeviceId)
      }
      this.masterControllerDeviceId = masterDeviceId
    }
    this.socket.once('__master_controller_id', (resMasterCId: string) => {
      updateMasterControllerId(resMasterCId)
      // @ts-ignore Defined in each subclass
      this.checkIsReady()
    })
    this.socket.on('__master_controller_id_changed', (newMasterCId: string) => {
      updateMasterControllerId(newMasterCId)
      this.handlerMasterControllerIdChange?.call(undefined)
    })
  }

  private generateDeviceId() {
    const savedDeviceId = localStorage.getItem('uq_device_id')
    if (savedDeviceId !== null) {
      return savedDeviceId
    }
    else {
      const newDeviceId = Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9)
      localStorage.setItem('uq_device_id', newDeviceId)
      return newDeviceId
    }
  }

  /** Indicates if the API is ready to use.  */
  public isReady: boolean = false;
  protected handlerOnReady?: Function;
  /** Get called when the API is ready to use. */
  onReady(callback: Function) {
    if (this.isReady) return callback();
    this.handlerOnReady = callback
  }

  /** Whether or not the socket is connected to the server. */
  get isConnected() {
    return this.socket.connected
  }

  /**
   * Get called when this device disconnects and reconnects to server.
   * @returns A function to remove the listener.
   */
  onDeviceConnectionStateChange(callback: (state: boolean) => void): UnsubscribeFunction {
    const handler = () => {
      callback(this.socket.connected)
    }
    this.socket.on('connect', handler)
    this.socket.on('disconnect', handler)

    return () => {
      this.socket.off('connect', handler)
      this.socket.off('disconnect', handler)
    }
  }

  /**
   * Get called when the server sets another controller as the master.
   * @returns A function to remove the listener.
   */
  onMasterControllerIdChange(callback: Function): UnsubscribeFunction {
    this.handlerMasterControllerIdChange = callback

    return () => {
      this.handlerMasterControllerIdChange = undefined
    }
  }

  /**
   * Send message to master controller.
   * @template D = Type of the first argument "data".
   */
  sendToMasterController<D = any>(data: D) {
    if (!this.masterControllerDeviceId) return;

    this.socket.emit('sendTo', {
      recipientDevice: this.masterControllerDeviceId,
      data,
    })
  }

  /**
   * Get called when a new message arrives from another device.
   * @returns A function to remove the listener.
   * @template D = Type of the argument "data".
   */
  onMessage<D = any>(
    callback: (data: D, fromDeviceId: string) => void
  ): UnsubscribeFunction {
    this.socket.on('message', callback)

    return () => {
      this.socket.off('message', callback)
    }
  }
}


interface ScreenOptions extends DefaultOptions {}

export class Screen extends Device {
  private connectedControllers: Set<string> | null = null;

  constructor(options: ScreenOptions) {
    super('screen', options)

    this.socket.once('__all_connected_controllers_id', (ids: string[]) => {
      this.connectedControllers = new Set(ids)
      this.checkIsReady()
    })

    this.socket.on('__new_controller', (deviceId) => {
      this.connectedControllers?.add(deviceId)
    })

    this.socket.on('__controller_disconnect', (deviceId) => {
      this.connectedControllers?.delete(deviceId)
    })

    this.socket.once('connect', this.checkIsReady.bind(this))
  }

  private checkIsReady() {
    if (this.isReady) return;
    if (
      this.connectedControllers !== null &&
      this.masterControllerDeviceId !== undefined &&
      this.socket.connected === true
    ) {
      this.isReady = true
      this.handlerOnReady?.call(undefined)
    }
  }

  /**
   * @returns An array with the id of all connected controllers.
   * @warning Can only be used within the "onReady" function because it's value is fetched asynchronous.
   */
  getAllControllerDeviceIds() {
    return Array.from(this.connectedControllers?.values()!)
  }

  /** @warning Can only be used within the "onReady" function because it's value is fetched asynchronous. */
  get totalOfConnectedControllers() {
    return this.connectedControllers?.size
  }

  /**
   * Gets called when a controller connects.
   * @returns A function to remove the listener.
   */
  onConnect(callback: (deviceId: string) => void): UnsubscribeFunction {
    this.socket.on('__new_controller', callback)

    return () => {
      this.socket.off('__new_controller', callback)
    }
  }

  /**
   * Gets called when a controller disconnects.
   * @returns A function to remove the listener.
   */
  onDisconnect(callback: (deviceId: string) => void): UnsubscribeFunction {
    this.socket.on('__controller_disconnect', callback)

    return () => {
      this.socket.off('__controller_disconnect', callback)
    }
  }

  /**
   * Send message to all connected controllers.
   * @template D = Type of the first argument "data".
   */
  broadcastToControllers<D = any>(data: D) {
    this.socket.emit('broadcast', { data })
  }

  /**
   * Send message to a specific controller.
   * @template D = Type of the second argument "data".
   */
  sendToController<D = any>(deviceId: string, data: D) {
    this.socket.emit('sendTo', {
      recipientDevice: deviceId,
      data
    })
  }
}


interface ControllerOptions extends DefaultOptions {
  /** Unique ID to this device. If you do not specify one, a random will be generated. */
  deviceId?: string,
}

export class Controller extends Device {
  /** @warning Can only be used within the "onReady" function because it's value is fetched asynchronous. */
  public isMasterController: boolean | null = null;
  /** @warning Can only be used within the "onReady" function because it's value is fetched asynchronous. */
  public isScreenConnected: boolean | null = null;
  private handlerScreenConnectionChange?: Function;

  constructor(options: ControllerOptions) {
    super('controller', options as any)

    this.socket.once('__screen_is_connected', (res) => {
      this.isScreenConnected = res
      this.checkIsReady()
    })

    this.socket.on('__screen_connected', () => {
      this.isScreenConnected = true
      this.handlerScreenConnectionChange?.call(undefined, this.isScreenConnected)
    })
    this.socket.on('__screen_disconnect', () => {
      this.isScreenConnected = false
      this.handlerScreenConnectionChange?.call(undefined, this.isScreenConnected)
    })

    this.socket.once('connect', this.checkIsReady.bind(this))
  }

  private checkIsReady() {
    if (this.isReady) return;
    if (
      this.masterControllerDeviceId !== undefined &&
      this.isMasterController !== null &&
      this.isScreenConnected !== null &&
      this.socket.connected === true
    ) {
      this.isReady = true
      this.handlerOnReady?.call(undefined)
    }
  }

  /**
   * Notify when the screen disconnects or reconnects from the server.
   * @returns A function to remove the listener.
   *
   * @example
   * controller.onScreenConnectionStateChange(isConnected => {
   *   // ...
   * })
   */
  onScreenConnectionStateChange(callback: (state: boolean) => void): UnsubscribeFunction {
    this.handlerScreenConnectionChange = callback

    return () => {
      this.handlerScreenConnectionChange = undefined
    }
  }

  /**
   * Send message to screen.
   * @template D = Type of the first argument "data".
   */
  sendToScreen<D = any>(data: D) {
    this.socket.emit('sendTo', {
      recipientDevice: 'screen',
      data,
    })
  }

  /**
   * @experimental I don't know if this function is useful or if it opens security vulnerabilities.
   *
   * Send message to all other connected controls except this one.
   * @template D = Type of the first argument "data".
   */
  unsafe_broadcastToOtherControllers<D = any>(data: D) {
    this.socket.emit('broadcast', {
      exceptFor: this.deviceId,
      data,
    })
  }

  /**
   * @experimental I don't know if this function is useful or if it opens security vulnerabilities.
   *
   * Send message to another specific controller.
   * @template D = Type of the second argument "data".
   */
  unsafe_sendToAnotherController<D = any>(deviceId: string, data: D) {
    this.socket.emit('sendTo', {
      recipientDevice: deviceId,
      data,
    })
  }
}

type UnsubscribeFunction = () => void;
