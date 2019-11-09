"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @example
 * import io from 'socket.io'
 * import { applyRCMMiddleware } from 'remote-controllers-manager'
 *
 * const server = io.listen(3000)
 * applyRCMMiddleware(server)
 */
function applyRCMMiddleware(io, options) {
    if (io === undefined || (io.emit === undefined && io.sockets === undefined)) {
        throw new Error('You must call the "applyRCMMiddleware" function with an instance of a socket.io server as the first argument.');
    }
    var defaultOptions = {
        maxConnectedControllers: Infinity,
        needsAMasterController: true,
        ifMasterControllerDisconnects: 'waitHimReconnect',
    };
    options = Object.assign(defaultOptions, options);
    var screen = null;
    var controllers = new Map();
    var masterControllerId = null;
    // Validate new connections
    io.use(function (socket, next) {
        var _a;
        var _b = socket.handshake.query, deviceKind = _b.deviceKind, deviceId = _b.deviceId;
        if (deviceKind === undefined || typeof deviceKind !== 'string') {
            return next(new Error('Invalid or not set "deviceKind".'));
        }
        if (deviceKind === 'screen' && screen !== null) {
            return next(new Error('There is already a screen connected.'));
        }
        if (deviceKind === 'controller') {
            if (controllers.size >= ((_a = options) === null || _a === void 0 ? void 0 : _a.maxConnectedControllers)) {
                return next(new Error('Maximum number of connected controllers was reached.'));
            }
            if (deviceId === undefined || typeof deviceId !== 'string') {
                return next(new Error('Invalid or not set "deviceId".'));
            }
            if (controllers.has(deviceId)) {
                return next(new Error('This controller is already connected.'));
            }
        }
        // Allow access
        next();
    });
    io.on('connection', function (socket) {
        var _a, _b;
        var _c = socket.handshake.query, deviceKind = _c.deviceKind, deviceId = _c.deviceId;
        if (deviceKind === 'screen') {
            screen = socket;
            socket.emit('__all_connected_controllers_id', Array.from(controllers.keys()));
            // Notify all controllers
            controllers.forEach(function (control) { return control.emit('__screen_connected'); });
        }
        else if (deviceKind === 'controller') {
            controllers.set(deviceId, socket);
            socket.emit('__screen_is_connected', screen !== null);
            // If it's the first controller to connect, set it as the master
            if (((_a = options) === null || _a === void 0 ? void 0 : _a.needsAMasterController) === true && masterControllerId === null) {
                masterControllerId = deviceId;
                io.emit('__master_controller_id_changed', masterControllerId);
            }
            (_b = screen) === null || _b === void 0 ? void 0 : _b.emit('__new_controller', deviceId);
        }
        socket.emit('__master_controller_id', masterControllerId);
        socket.on('broadcast', function (_a) {
            var data = _a.data, exceptFor = _a.exceptFor;
            controllers.forEach(function (controllerSocket, controllerId) {
                if (exceptFor && controllerId === exceptFor)
                    return;
                controllerSocket.emit('message', data, deviceId);
            });
        });
        socket.on('sendTo', function (_a) {
            var recipientDevice = _a.recipientDevice, data = _a.data;
            var _b, _c;
            if (recipientDevice === 'screen') {
                return (_b = screen) === null || _b === void 0 ? void 0 : _b.emit('message', data, deviceId);
            }
            var device = controllers.get(recipientDevice);
            (_c = device) === null || _c === void 0 ? void 0 : _c.emit('message', data, deviceId);
        });
        socket.on('disconnect', function () {
            var _a, _b, _c, _d, _e, _f;
            if (deviceKind === 'screen') {
                screen = null;
                controllers.forEach(function (control) {
                    control.emit('__screen_disconnect');
                });
            }
            else if (deviceKind === 'controller') {
                controllers.delete(deviceId);
                (_a = screen) === null || _a === void 0 ? void 0 : _a.emit('__controller_disconnect', deviceId);
                // what to do when master controller disconnects
                if (deviceId === masterControllerId && ((_b = options) === null || _b === void 0 ? void 0 : _b.needsAMasterController)) {
                    if (((_c = options) === null || _c === void 0 ? void 0 : _c.ifMasterControllerDisconnects) === 'passToNext') {
                        masterControllerId = (_d = controllers.keys().next().value, (_d !== null && _d !== void 0 ? _d : null));
                        (_e = io) === null || _e === void 0 ? void 0 : _e.emit('__master_controller_id_changed', masterControllerId);
                    }
                    else if (((_f = options) === null || _f === void 0 ? void 0 : _f.ifMasterControllerDisconnects) === 'waitHimReconnect') { /* do nothing */ }
                }
            }
        });
    });
}
exports.applyRCMMiddleware = applyRCMMiddleware;
