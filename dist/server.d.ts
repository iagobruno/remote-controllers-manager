import { Server as IOServerType } from 'socket.io';
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
/**
 * @example
 * import io from 'socket.io'
 * import { applyRCMMiddleware } from 'remote-controllers-manager'
 *
 * const server = io.listen(3000)
 * applyRCMMiddleware(server)
 */
export declare function applyRCMMiddleware(io: IOServerType, inputOptions?: Partial<ServerOptions>): void;
export {};
