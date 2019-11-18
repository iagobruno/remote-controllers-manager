"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var defaultOptions = {
    allowMultipleRooms: true,
    maxControllersPerRoom: Infinity,
    eachRoomNeedsAMasterController: true,
    ifMasterControllerDisconnects: 'waitReconnect',
    limitOfConnectionsToServer: Infinity,
};
var rooms = {};
var numberOfDevicesConnected = 0;
/**
 * @example
 * import io from 'socket.io'
 * import { applyRCMMiddleware } from 'remote-controllers-manager'
 *
 * const server = io.listen(3000)
 * applyRCMMiddleware(server)
 */
function applyRCMMiddleware(io, opts) {
    if (io === undefined || (io.emit === undefined && io.sockets === undefined)) {
        throw new Error('You must call the "applyRCMMiddleware" function with an instance of a socket.io server as the first argument.');
    }
    var options = Object.assign(defaultOptions, opts);
    // Validate new connections
    io.use(function (socket, next) {
        var _a, _b;
        var _c = socket.handshake.query, deviceKind = _c.deviceKind, deviceId = _c.deviceId, roomIdToConnect = _c.roomIdToConnect;
        if (numberOfDevicesConnected >= options.limitOfConnectionsToServer) {
            return next(new Error('The limit of devices connected to the server has been reached.'));
        }
        if (deviceKind === undefined || typeof deviceKind !== 'string')
            return next(new Error('Invalid or not set "deviceKind".'));
        if (deviceId === undefined || typeof deviceId !== 'string')
            return next(new Error('Invalid or not set "deviceId".'));
        if (deviceKind === 'screen') {
            if (options.allowMultipleRooms === false &&
                Object.keys(rooms).length >= 1 &&
                Object.keys(rooms)[0] !== deviceId) {
                return next(new Error('The limit of rooms in the server has been reached.'));
            }
            if ((_b = (_a = rooms[deviceId]) === null || _a === void 0 ? void 0 : _a.screenSocket, (_b !== null && _b !== void 0 ? _b : null)) !== null) {
                return next(new Error('There is already a screen connected to this room.'));
            }
        }
        if (deviceKind === 'controller') {
            if (roomIdToConnect === undefined) {
                return next(new Error('You must specify the room id you want to connect to.'));
            }
            var room = rooms[roomIdToConnect];
            if (!room) {
                return next(new Error('This room doesn’t exist.'));
            }
            if (room.controllers.length >= options.maxControllersPerRoom) {
                return next(new Error('The limit of connected controllers per room has been reached.'));
            }
            var isAlreadyConnected = room.controllers.find(function (ctrl) { return ctrl.deviceId === deviceId; }) !== undefined;
            if (isAlreadyConnected) {
                return next(new Error('This controller is already connected in this room.'));
            }
        }
        // Allow access
        next();
    });
    io.on('connection', function (socket) {
        var _a, _b;
        numberOfDevicesConnected++;
        var _c = socket.handshake.query, deviceKind = _c.deviceKind, deviceId = _c.deviceId, roomIdToConnect = _c.roomIdToConnect;
        /** Instance of room the device is connected to. */
        var room;
        if (deviceKind === 'screen') {
            room = findOrCreateRoom(deviceId);
            room.screenSocket = socket;
            room.screenSocket.emit('__all_connected_controllers_id', room.controllers.map(function (ctrl) { return ctrl.deviceId; }));
            // Notify all controllers in this room
            room.controllers.forEach(function (ctrl) { return ctrl.socket.emit('__screen_connected'); });
        }
        else if (deviceKind === 'controller') {
            room = rooms[roomIdToConnect];
            (_a = room.screenSocket) === null || _a === void 0 ? void 0 : _a.emit('__new_controller', deviceId);
            room.controllers.push({
                deviceId: deviceId,
                socket: socket
            });
            socket.emit('__screen_is_connected', room.screenSocket !== null);
            // If it's the first controller to connect, set it as the master
            if (((_b = options) === null || _b === void 0 ? void 0 : _b.eachRoomNeedsAMasterController) && room.masterControllerDeviceId === null) {
                room.masterControllerDeviceId = deviceId;
                // Notify all devices in this room about the new master controller
                sendMessageToAllDevicesInTheRoom(room, room.masterControllerDeviceId);
            }
        }
        socket.emit('__master_controller_id', room.masterControllerDeviceId);
        socket.on('broadcast', function (_a) {
            var data = _a.data, exceptFor = _a.exceptFor;
            room.controllers.forEach(function (ctrl) {
                if (exceptFor && ctrl.deviceId === exceptFor)
                    return;
                ctrl.socket.emit('message', data, deviceId);
            });
        });
        socket.on('sendTo', function (_a) {
            var recipientDevice = _a.recipientDevice, data = _a.data;
            var _b, _c;
            if (recipientDevice === 'screen') {
                (_b = room.screenSocket) === null || _b === void 0 ? void 0 : _b.emit('message', data, deviceId);
                return;
            }
            if (recipientDevice === 'master_controller') {
                recipientDevice = room.masterControllerDeviceId;
            }
            var device = room.controllers.find(function (ctrl) { return ctrl.deviceId === recipientDevice; });
            (_c = device) === null || _c === void 0 ? void 0 : _c.socket.emit('message', data, deviceId);
        });
        socket.on('disconnect', function () {
            var _a, _b, _c;
            numberOfDevicesConnected--;
            if (deviceKind === 'screen') {
                room.screenSocket = null;
                room.controllers.forEach(function (ctrl) {
                    ctrl.socket.emit('__screen_disconnect');
                });
            }
            else if (deviceKind === 'controller') {
                room.controllers = room.controllers.filter(function (ctrl) { return ctrl.deviceId !== deviceId; });
                (_a = room.screenSocket) === null || _a === void 0 ? void 0 : _a.emit('__controller_disconnect', deviceId);
                // What to do when master controller disconnects
                if (deviceId === room.masterControllerDeviceId && options.eachRoomNeedsAMasterController) {
                    if (options.ifMasterControllerDisconnects === 'waitReconnect') {
                        /* do nothing */
                    }
                    else if (options.ifMasterControllerDisconnects === 'passToNext') {
                        room.masterControllerDeviceId = (_c = (_b = room.controllers[0]) === null || _b === void 0 ? void 0 : _b.deviceId, (_c !== null && _c !== void 0 ? _c : null));
                        // Notify all devices in this room about the new master controller
                        sendMessageToAllDevicesInTheRoom(room, room.masterControllerDeviceId);
                    }
                }
            }
            checkIfCanDeleteTheRoom(room);
        });
    });
}
exports.applyRCMMiddleware = applyRCMMiddleware;
function findOrCreateRoom(ID) {
    var roomAlreadyCreated = rooms[ID] !== undefined;
    if (roomAlreadyCreated)
        return rooms[ID];
    var newRoom = {
        ID: ID,
        screenSocket: null,
        masterControllerDeviceId: null,
        controllers: [],
    };
    rooms[ID] = newRoom;
    return newRoom;
}
/**
 * It's like the garbage collector.
 * It checks if there is at least one device connected to the room, if not, the room is removed.
 */
function checkIfCanDeleteTheRoom(room) {
    if (typeof room === 'string')
        room = rooms[room];
    var numberOfDevices = room.controllers.length + (room.screenSocket === null ? 0 : 1);
    if (numberOfDevices === 0) {
        delete rooms[room.ID];
    }
}
function sendMessageToAllDevicesInTheRoom(room, data) {
    var _a;
    if (typeof room === 'string')
        room = rooms[room];
    (_a = room.screenSocket) === null || _a === void 0 ? void 0 : _a.emit('__master_controller_id_changed', data);
    room.controllers.forEach(function (ctrl) {
        ctrl.socket.emit('__master_controller_id_changed', data);
    });
}
