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
  /** Unique id for this device. */
  protected deviceId?: string;
  protected masterControllerDeviceId: string | undefined = undefined;
  private handlerMasterControllerIdChange?: Function;
  /** socket.io-client instance */
  public socket: SocketIOClient.Socket;

  constructor(
    private kind: 'screen' | 'controller',
    options?: DeviceOptions
  ) {
    options = Object.assign(defaultOptions, options)

    this.deviceId = (kind === 'screen') ? 'screen' : options.deviceId ?? this.generateDeviceId()
    this.socket = io(options.url, {
      autoConnect: options.autoConnect,
      query: {
        deviceKind: this.kind,
        deviceId: this.deviceId,
      }
    })

    this.socket.once('__master_controller_id', (resMasterCId: string) => {
      this.masterControllerDeviceId = resMasterCId
      if (kind === 'controller') {
        // @ts-ignore
        this.isMasterController = (this.deviceId === resMasterCId)
      }
      // @ts-ignore Defined in each subclass
      this.checkIsReady()
    })
    this.socket.on('__master_controller_id_changed', (newMasterControllerId: string) => {
      this.masterControllerDeviceId = newMasterControllerId
      if (kind === 'controller') {
        // @ts-ignore
        this.isMasterController = (this.deviceId === newMasterControllerId)
      }
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
  /** Add a listener to call back when the API is ready to use. */
  onReady(callback: Function) {
    if (this.isReady) return callback();
    this.handlerOnReady = callback
  }

  /** When THIS device connects. */
  onConnect(callbackOnSuccess: Function, callbackOnConnectionFailure?: Function): UnsubscribeFunction {
    if (this.isConnected) callbackOnSuccess()

    this.socket.on('connect', () => {
      if (callbackOnConnectionFailure) this.socket.off('error')
      callbackOnSuccess()
    })
    if (callbackOnConnectionFailure) {
      this.socket.once('error', (...err) => {
        unsubscribe()
        this.socket.disconnect()
        callbackOnConnectionFailure(...err)
      })
    }

    const unsubscribe = () => {
      this.socket.off('connect', callbackOnSuccess)
    }

    return unsubscribe
  }

  /** When THIS device disconnects. */
  onDisconnect(callback: Function): UnsubscribeFunction {
    if (!this.isConnected) callback()
    this.socket.on('disconnect', callback)

    return () => {
      this.socket.off('disconnect', callback)
    }
  }

  get isConnected() {
    return this.socket.connected
  }

  getMasterControllerDeviceId() {
    return this.masterControllerDeviceId
  }

  onMasterControllerIdChange(callback: Function): UnsubscribeFunction {
    this.handlerMasterControllerIdChange = callback

    return () => {
      this.handlerMasterControllerIdChange = undefined
    }
  }

  /**
   * Listen for new messages from other device.
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
  private handlerControllerConnection?: Function;
  private handlerControllerDisconnects?: Function;

  constructor(options?: ScreenOptions) {
    super('screen', options)

    this.socket.once('__all_connected_controllers_id', (ids: string[]) => {
      this.connectedControllers = new Set(ids)
      this.checkIsReady()
    })

    this.socket.on('__new_controller', (deviceId) => {
      this.connectedControllers?.add(deviceId)
      this.handlerControllerConnection?.call(undefined, deviceId)
    })

    this.socket.on('__controller_disconnect', (deviceId) => {
      this.connectedControllers?.delete(deviceId)
      this.handlerControllerDisconnects?.call(undefined, deviceId)
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

  /** Returns an array with the id of all connected controllers. */
  getAllControllerDeviceIds() {
    return Array.from(this.connectedControllers?.values()!)
  }

  getTotalOfConnectedControllers() {
    return this.connectedControllers?.size
  }

  onNewControllerConnects( callback: (deviceId: string) => void, ): UnsubscribeFunction {
    this.handlerControllerConnection = callback

    return () => {
      this.handlerControllerConnection = undefined
    }
  }

  onControllerDisconnects( callback: (deviceId: string) => void, ): UnsubscribeFunction {
    this.handlerControllerDisconnects = callback

    return () => {
      this.handlerControllerDisconnects = undefined
    }
  }

  /**
   * Send message to ALL connected controllers.
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
  /** Indicates if this was the first control connected */
  public isMasterController: boolean | null = null;
  public isScreenConnected: boolean | null = null;
  private handlerScreenConnectionChange?: Function;

  constructor(options?: ControllerOptions) {
    super('controller', options as any)

    this.socket.once('__screen_is_connected', (res) => {
      this.isScreenConnected = res
      this.checkIsReady()
    })

    this.socket.on('__screen_connected', () => {
      this.isScreenConnected = true
      this.handlerScreenConnectionChange?.call(undefined)
    })
    this.socket.on('__screen_disconnect', () => {
      this.isScreenConnected = false
      this.handlerScreenConnectionChange?.call(undefined)
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

  /** Returns the unique id that identifies this device from others. */
  getDeviceId() {
    return this.deviceId
  }

  /**
   * Notify when the screen disconnects from the server or reconnects.
   * @example
   * controller.onScreenConnectionChanges(() => {
   *   if (controller.isScreenConnected) {
   *     // ...
   *   } else { }
   * })
   */
  onScreenConnectionChanges(callback: Function): UnsubscribeFunction {
    callback()
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

  /**
   * @experimental I don't know if this function is useful or if it opens security vulnerabilities.
   *
   * Send message to master controller.
   * @template D = Type of the first argument "data".
   */
  unsafe_sendToMasterController<D = any>(data: D) {
    this.socket.emit('sendTo', {
      recipientDevice: this.masterControllerDeviceId,
      data,
    })
  }
}

type UnsubscribeFunction = () => void;
