import { Server as IOServerType } from 'socket.io';
interface ServerOptions {
    /** @default Infinity */
    maxConnectedControllers?: number;
    /** @default true */
    needsAMasterController?: boolean;
    /** @default "waitHimReconnect" */
    ifMasterControllerDisconnects?: 'passToNext' | 'waitHimReconnect';
}
/**
 * @example
 * import io from 'socket.io'
 * import { applyRCMMiddleware } from 'remote-controllers-manager'
 *
 * const server = io.listen(3000)
 * applyRCMMiddleware(server)
 */
export declare function applyRCMMiddleware(io: IOServerType, options?: ServerOptions): void;
export {};
