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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var socket_io_client_1 = __importDefault(require("socket.io-client"));
var defaultOptions = {
    autoConnect: true,
};
var Device = /** @class */ (function () {
    function Device(kind, options) {
        var _this = this;
        var _a;
        this.kind = kind;
        /**
         * If null, means that has been configured on the server that does not require a master controller.
         * @warning Can only be used within the "onReady" function because it's value is fetched asynchronous.
         */
        this.masterControllerDeviceId = undefined;
        /** Indicates if the API is ready to use.  */
        this.isReady = false;
        options = Object.assign(defaultOptions, options);
        this.deviceId = (this.kind === 'screen') ? 'screen' : (_a = options.deviceId, (_a !== null && _a !== void 0 ? _a : this.generateDeviceId()));
        this.socket = socket_io_client_1.default(options.url, {
            autoConnect: options.autoConnect,
            query: {
                deviceKind: this.kind,
                deviceId: this.deviceId,
            }
        });
        var updateMasterControllerId = function (masterDeviceId) {
            if (_this.kind === 'controller') {
                // @ts-ignore
                _this.isMasterController = (_this.deviceId === masterDeviceId);
            }
            _this.masterControllerDeviceId = masterDeviceId;
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
            var newDeviceId = Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('uq_device_id', newDeviceId);
            return newDeviceId;
        }
    };
    /** Get called when the API is ready to use. */
    Device.prototype.onReady = function (callback) {
        if (this.isReady)
            return callback();
        this.handlerOnReady = callback;
    };
    Object.defineProperty(Device.prototype, "isConnected", {
        /** Whether or not the socket is connected to the server. */
        get: function () {
            return this.socket.connected;
        },
        enumerable: true,
        configurable: true
    });
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
    Screen.prototype.checkIsReady = function () {
        var _a;
        if (this.isReady)
            return;
        if (this.connectedControllers !== null &&
            this.masterControllerDeviceId !== undefined &&
            this.socket.connected === true) {
            this.isReady = true;
            (_a = this.handlerOnReady) === null || _a === void 0 ? void 0 : _a.call(undefined);
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
    Controller.prototype.checkIsReady = function () {
        var _a;
        if (this.isReady)
            return;
        if (this.masterControllerDeviceId !== undefined &&
            this.isMasterController !== null &&
            this.isScreenConnected !== null &&
            this.socket.connected === true) {
            this.isReady = true;
            (_a = this.handlerOnReady) === null || _a === void 0 ? void 0 : _a.call(undefined);
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
