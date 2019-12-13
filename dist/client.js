"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var socket_io_client_1 = __importDefault(require("socket.io-client"));
var Device = /** @class */ (function () {
    function Device(kind, _a) {
        var _this = this;
        var uri = _a.uri, query = _a.query, deviceId = _a.deviceId, options = __rest(_a, ["uri", "query", "deviceId"]);
        this.kind = kind;
        /**
         * If null, means that has been configured on the server that does not require a master controller.
         * @warning Can only be used within the "onReady" function because it's value is fetched asynchronous.
         */
        this.masterControllerDeviceId = undefined;
        /** Indicates if the API is ready to use.  */
        this.isReady = false;
        this.deviceId = kind === 'controller' ? ((deviceId !== null && deviceId !== void 0 ? deviceId : this.generateDeviceId())) : undefined;
        this.socket = socket_io_client_1.default.connect(uri, __assign(__assign({}, options), { query: __assign(__assign({}, query), { deviceKind: this.kind, deviceId: this.deviceId }), autoConnect: false }));
        var updateMasterControllerId = function (masterDeviceId) {
            _this.masterControllerDeviceId = masterDeviceId;
            // @ts-ignore
            if (_this.kind === 'controller')
                _this.isMasterController = (_this.deviceId === masterDeviceId);
        };
        this.socket.once('__master_controller_id', function (resMasterCId) {
            updateMasterControllerId(resMasterCId);
            // @ts-ignore Defined in each subclass
            _this.checkIsReady();
        });
        this.socket.on('__master_controller_id_changed', function (newMasterCId) {
            var _a;
            updateMasterControllerId(newMasterCId);
            (_a = _this.handlerMasterControllerIdChange) === null || _a === void 0 ? void 0 : _a.call(undefined);
        });
    }
    Device.prototype.generateDeviceId = function () {
        var savedDeviceId = localStorage.getItem('uq_device_id');
        if (savedDeviceId !== null) {
            return savedDeviceId;
        }
        else {
            var newDeviceId = Date.now() + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('uq_device_id', newDeviceId);
            return newDeviceId;
        }
    };
    Object.defineProperty(Device.prototype, "isConnected", {
        /** Whether or not the socket is connected to the server. */
        get: function () {
            return this.socket.connected;
        },
        enumerable: true,
        configurable: true
    });
    Device.prototype.connectionPromise = function () {
        var _this = this;
        if (this.isConnected)
            return Promise.resolve();
        return new Promise(function (resolve, reject) {
            var handleConnect = function () {
                removeListeners();
                resolve();
            };
            var handleError = function (err) {
                _this.socket.disconnect();
                removeListeners();
                reject(err);
            };
            var removeListeners = function () {
                _this.socket.off('connect', handleConnect);
                _this.socket.off('error', handleError);
            };
            _this.socket.once('connect', handleConnect);
            _this.socket.once('error', handleError);
        });
    };
    /**
     * Get called when this device disconnects and reconnects to server.
     * @returns A function to remove the listener.
     */
    Device.prototype.onDeviceConnectionStateChange = function (callback) {
        var _this = this;
        var handler = function () {
            callback(_this.socket.connected);
        };
        this.socket.on('connect', handler);
        this.socket.on('disconnect', handler);
        handler();
        return function () {
            _this.socket.off('connect', handler);
            _this.socket.off('disconnect', handler);
        };
    };
    /**
     * Get called when the server sets another controller as the master.
     * @returns A function to remove the listener.
     */
    Device.prototype.onMasterControllerIdChange = function (callback) {
        var _this = this;
        this.handlerMasterControllerIdChange = callback;
        return function () {
            _this.handlerMasterControllerIdChange = undefined;
        };
    };
    /**
     * Send message to master controller.
     * @template D = Type of the first argument "data".
     */
    Device.prototype.sendToMasterController = function (data) {
        if (!this.masterControllerDeviceId)
            return;
        this.socket.emit('sendTo', {
            recipientDevice: this.masterControllerDeviceId,
            data: data,
        });
    };
    /**
     * Get called when a new message arrives from another device.
     * @returns A function to remove the listener.
     * @template D = Type of the argument "data".
     */
    Device.prototype.onMessage = function (callback) {
        var _this = this;
        this.socket.on('message', callback);
        return function () {
            _this.socket.off('message', callback);
        };
    };
    return Device;
}());
var Screen = /** @class */ (function (_super) {
    __extends(Screen, _super);
    function Screen(options) {
        var _this = _super.call(this, 'screen', options) || this;
        _this.connectedControllers = null;
        _this.socket.once('__screen_device_id', function (deviceId) {
            _this.deviceId = id;
            _this.socket.io.opts.query = Object.assign(_this.socket.io.opts.query, {
                deviceId: deviceId,
            });
            _this.checkIsReady();
        });
        _this.socket.once('__all_connected_controllers_id', function (ids) {
            _this.connectedControllers = new Set(ids);
            _this.checkIsReady();
        });
        _this.socket.on('__new_controller', function (deviceId) {
            var _a;
            (_a = _this.connectedControllers) === null || _a === void 0 ? void 0 : _a.add(deviceId);
        });
        _this.socket.on('__controller_disconnect', function (deviceId) {
            var _a;
            (_a = _this.connectedControllers) === null || _a === void 0 ? void 0 : _a.delete(deviceId);
        });
        _this.socket.once('connect', _this.checkIsReady.bind(_this));
        return _this;
    }
    /**
     * Start connection.
     * @returns A promise to indicate if the connection was successful.
     */
    Screen.prototype.start = function () {
        var _this = this;
        if (this.isConnected)
            return Promise.resolve('You are already connected.');
        this.socket.connect();
        return this.connectionPromise()
            .then(function () { return new Promise(function (resolve) {
            if (_this.isReady)
                return resolve();
            _this.onReadyHandler = resolve;
        }); });
    };
    Screen.prototype.checkIsReady = function () {
        var _a;
        if (this.isReady)
            return;
        if (this.connectedControllers !== null &&
            this.masterControllerDeviceId !== undefined &&
            this.socket.connected === true &&
            this.deviceId !== undefined) {
            this.isReady = true;
            (_a = this.onReadyHandler) === null || _a === void 0 ? void 0 : _a.call(undefined);
        }
    };
    /**
     * @returns An array with the id of all connected controllers.
     * @warning Can only be used within the "onReady" function because it's value is fetched asynchronous.
     */
    Screen.prototype.getAllControllerDeviceIds = function () {
        var _a;
        return Array.from((_a = this.connectedControllers) === null || _a === void 0 ? void 0 : _a.values());
    };
    Object.defineProperty(Screen.prototype, "totalOfConnectedControllers", {
        /** @warning Can only be used within the "onReady" function because it's value is fetched asynchronous. */
        get: function () {
            var _a;
            return (_a = this.connectedControllers) === null || _a === void 0 ? void 0 : _a.size;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Gets called when a controller connects.
     * @returns A function to remove the listener.
     */
    Screen.prototype.onConnect = function (callback) {
        var _this = this;
        this.socket.on('__new_controller', callback);
        return function () {
            _this.socket.off('__new_controller', callback);
        };
    };
    /**
     * Gets called when a controller disconnects.
     * @returns A function to remove the listener.
     */
    Screen.prototype.onDisconnect = function (callback) {
        var _this = this;
        this.socket.on('__controller_disconnect', callback);
        return function () {
            _this.socket.off('__controller_disconnect', callback);
        };
    };
    /**
     * Send message to all connected controllers.
     * @template D = Type of the first argument "data".
     */
    Screen.prototype.broadcastToControllers = function (data) {
        this.socket.emit('broadcast', { data: data });
    };
    /**
     * Send message to a specific controller.
     * @template D = Type of the second argument "data".
     */
    Screen.prototype.sendToController = function (deviceId, data) {
        this.socket.emit('sendTo', {
            recipientDevice: deviceId,
            data: data
        });
    };
    return Screen;
}(Device));
exports.Screen = Screen;
var Controller = /** @class */ (function (_super) {
    __extends(Controller, _super);
    function Controller(options) {
        var _this = _super.call(this, 'controller', options) || this;
        /** @warning Can only be used within the "onReady" function because it's value is fetched asynchronous. */
        _this.isMasterController = null;
        _this.idOfScreenWhichIsConnectedTo = null;
        /** @warning Can only be used within the "onReady" function because it's value is fetched asynchronous. */
        _this.isScreenConnected = null;
        _this.socket.once('__screen_is_connected', function (res) {
            _this.isScreenConnected = res;
            _this.checkIsReady();
        });
        _this.socket.on('__screen_connected', function () {
            var _a;
            _this.isScreenConnected = true;
            (_a = _this.handlerScreenConnectionChange) === null || _a === void 0 ? void 0 : _a.call(undefined, _this.isScreenConnected);
        });
        _this.socket.on('__screen_disconnect', function () {
            var _a;
            _this.isScreenConnected = false;
            (_a = _this.handlerScreenConnectionChange) === null || _a === void 0 ? void 0 : _a.call(undefined, _this.isScreenConnected);
        });
        _this.socket.once('connect', _this.checkIsReady.bind(_this));
        return _this;
    }
    /**
     * Start connection.
     * @param screenId Indicates which screen the control should connect to. User must manually enter the ID that can be shown on the screen.
     * @returns A promise to indicate if the connection was successful.
     */
    Controller.prototype.connectToScreen = function (screenId) {
        var _this = this;
        if (this.isConnected)
            return Promise.resolve('You are already connected.');
        this.socket.io.opts.query = Object.assign(this.socket.io.opts.query, {
            roomIdToConnect: screenId
        });
        this.socket.connect();
        return this.connectionPromise()
            .then(function () {
            _this.idOfScreenWhichIsConnectedTo = screenId;
            return;
        })
            .then(function () { return new Promise(function (resolve) {
            if (_this.isReady)
                return resolve();
            _this.onReadyHandler = resolve;
        }); });
    };
    Controller.prototype.checkIsReady = function () {
        var _a;
        if (this.isReady)
            return;
        if (this.masterControllerDeviceId !== undefined &&
            this.isMasterController !== null &&
            this.isScreenConnected !== null &&
            this.socket.connected === true) {
            this.isReady = true;
            (_a = this.onReadyHandler) === null || _a === void 0 ? void 0 : _a.call(undefined);
        }
    };
    /**
     * Notify when the screen disconnects or reconnects from the server.
     * @returns A function to remove the listener.
     *
     * @example
     * controller.onScreenConnectionStateChange(isConnected => {
     *   // ...
     * })
     */
    Controller.prototype.onScreenConnectionStateChange = function (callback) {
        var _this = this;
        this.handlerScreenConnectionChange = callback;
        return function () {
            _this.handlerScreenConnectionChange = undefined;
        };
    };
    /**
     * Send message to screen.
     * @template D = Type of the first argument "data".
     */
    Controller.prototype.sendToScreen = function (data) {
        this.socket.emit('sendTo', {
            recipientDevice: 'screen',
            data: data,
        });
    };
    /**
     * @experimental I don't know if this function is useful or if it opens security vulnerabilities.
     *
     * Send message to all other connected controls except this one.
     * @template D = Type of the first argument "data".
     */
    Controller.prototype.unsafe_broadcastToOtherControllers = function (data) {
        this.socket.emit('broadcast', {
            exceptFor: this.deviceId,
            data: data,
        });
    };
    /**
     * @experimental I don't know if this function is useful or if it opens security vulnerabilities.
     *
     * Send message to another specific controller.
     * @template D = Type of the second argument "data".
     */
    Controller.prototype.unsafe_sendToAnotherController = function (deviceId, data) {
        this.socket.emit('sendTo', {
            recipientDevice: deviceId,
            data: data,
        });
    };
    return Controller;
}(Device));
exports.Controller = Controller;
