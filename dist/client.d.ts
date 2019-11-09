/// <reference types="socket.io-client" />
interface DefaultOptions {
    url: string;
    autoConnect?: boolean;
}
declare type DeviceOptions = ControllerOptions & ScreenOptions;
declare class Device {
    private kind;
    /** Stable unique ID that represents this device. */
    deviceId?: string;
    /**
     * If null, means that has been configured on the server that does not require a master controller.
     * @warning Can only be used within the "onReady" function because it's value is fetched asynchronous.
     */
    masterControllerDeviceId: string | null | undefined;
    private handlerMasterControllerIdChange?;
    /** Instance of socket.io-client to be reused. */
    socket: SocketIOClient.Socket;
    constructor(kind: 'screen' | 'controller', options: DeviceOptions);
    private generateDeviceId;
    /** Indicates if the API is ready to use.  */
    isReady: boolean;
    protected handlerOnReady?: Function;
    /** Get called when the API is ready to use. */
    onReady(callback: Function): any;
    /** Whether or not the socket is connected to the server. */
    get isConnected(): boolean;
    /**
     * Get called when this device disconnects and reconnects to server.
     * @returns A function to remove the listener.
     */
    onDeviceConnectionStateChange(callback: (state: boolean) => void): UnsubscribeFunction;
    /**
     * Get called when the server sets another controller as the master.
     * @returns A function to remove the listener.
     */
    onMasterControllerIdChange(callback: Function): UnsubscribeFunction;
    /**
     * Send message to master controller.
     * @template D = Type of the first argument "data".
     */
    sendToMasterController<D = any>(data: D): void;
    /**
     * Get called when a new message arrives from another device.
     * @returns A function to remove the listener.
     * @template D = Type of the argument "data".
     */
    onMessage<D = any>(callback: (data: D, fromDeviceId: string) => void): UnsubscribeFunction;
}
interface ScreenOptions extends DefaultOptions {
}
export declare class Screen extends Device {
    private connectedControllers;
    constructor(options: ScreenOptions);
    private checkIsReady;
    /**
     * @returns An array with the id of all connected controllers.
     * @warning Can only be used within the "onReady" function because it's value is fetched asynchronous.
     */
    getAllControllerDeviceIds(): string[];
    /** @warning Can only be used within the "onReady" function because it's value is fetched asynchronous. */
    get totalOfConnectedControllers(): number | undefined;
    /**
     * Gets called when a controller connects.
     * @returns A function to remove the listener.
     */
    onConnect(callback: (deviceId: string) => void): UnsubscribeFunction;
    /**
     * Gets called when a controller disconnects.
     * @returns A function to remove the listener.
     */
    onDisconnect(callback: (deviceId: string) => void): UnsubscribeFunction;
    /**
     * Send message to all connected controllers.
     * @template D = Type of the first argument "data".
     */
    broadcastToControllers<D = any>(data: D): void;
    /**
     * Send message to a specific controller.
     * @template D = Type of the second argument "data".
     */
    sendToController<D = any>(deviceId: string, data: D): void;
}
interface ControllerOptions extends DefaultOptions {
    /** Unique ID to this device. If you do not specify one, a random will be generated. */
    deviceId?: string;
}
export declare class Controller extends Device {
    /** @warning Can only be used within the "onReady" function because it's value is fetched asynchronous. */
    isMasterController: boolean | null;
    /** @warning Can only be used within the "onReady" function because it's value is fetched asynchronous. */
    isScreenConnected: boolean | null;
    private handlerScreenConnectionChange?;
    constructor(options: ControllerOptions);
    private checkIsReady;
    /**
     * Notify when the screen disconnects or reconnects from the server.
     * @returns A function to remove the listener.
     *
     * @example
     * controller.onScreenConnectionStateChange(isConnected => {
     *   // ...
     * })
     */
    onScreenConnectionStateChange(callback: (state: boolean) => void): UnsubscribeFunction;
    /**
     * Send message to screen.
     * @template D = Type of the first argument "data".
     */
    sendToScreen<D = any>(data: D): void;
    /**
     * @experimental I don't know if this function is useful or if it opens security vulnerabilities.
     *
     * Send message to all other connected controls except this one.
     * @template D = Type of the first argument "data".
     */
    unsafe_broadcastToOtherControllers<D = any>(data: D): void;
    /**
     * @experimental I don't know if this function is useful or if it opens security vulnerabilities.
     *
     * Send message to another specific controller.
     * @template D = Type of the second argument "data".
     */
    unsafe_sendToAnotherController<D = any>(deviceId: string, data: D): void;
}
declare type UnsubscribeFunction = () => void;
export {};
