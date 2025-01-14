(function () {
    'use strict';

    angular.module('ariaNg').factory('aria2WebSocketRpcService', ['$q', 'ariaNgNativeElectronService', '$timeout', 'ariaNgConstants', 'ariaNgSettingService', 'ariaNgLogService', function ($q, ariaNgNativeElectronService, $timeout, ariaNgConstants, ariaNgSettingService, ariaNgLogService) {
        var websocketStatusConnecting = 0;
        var websocketStatusOpen = 1;

        var rpcUrl = ariaNgSettingService.getCurrentRpcUrl();
        var socketClient = null;
        var pendingReconnect = null;

        var sendIdStates = {};
        var eventCallbacks = {};

        var processMethodCallback = function (content) {
            var uniqueId = content.id;

            if (!uniqueId) {
                return;
            }

            var state = sendIdStates[uniqueId];

            if (!state) {
                return;
            }

            var context = state.context;

            state.deferred.resolve({
                success: true,
                context: context
            });

            if (content.result && context.connectionSuccessCallback) {
                context.connectionSuccessCallback({
                    rpcUrl: rpcUrl
                });
            }

            if (content.result && context.successCallback) {
                ariaNgLogService.debug('[aria2WebSocketRpcService.request] ' + (context && context.requestBody && context.requestBody.method ? context.requestBody.method + ' ' : '') + 'response success', content);

                context.successCallback(context.id, content.result);
            }

            if (content.error && context.errorCallback) {
                ariaNgLogService.debug('[aria2WebSocketRpcService.request] ' + (context && context.requestBody && context.requestBody.method ? context.requestBody.method + ' ' : '') + 'response error', content);

                context.errorCallback(context.id, content.error);
            }

            delete sendIdStates[uniqueId];
        };

        var processEventCallback = function (content) {
            var method = content.method;

            if (!method) {
                return;
            }

            var callbacks = eventCallbacks[method];

            if (!angular.isArray(callbacks) || callbacks.length < 1) {
                return;
            }

            for (var i = 0; i < callbacks.length; i++) {
                var callback = callbacks[i];
                var context = (angular.isArray(content.params) && content.params.length > 0 ? content.params[0] : null);
                callback(context);
            }
        };

        var getSocketClient = function (context) {
            if (socketClient === null) {
                try {
                    socketClient = ariaNgNativeElectronService.createWebSocketClient(rpcUrl, {
                        maxTimeout: 1 // ms
                    });

                    socketClient.onMessage(function (message) {
                        if (!message || !message.data) {
                            return;
                        }

                        var content = angular.fromJson(message.data);

                        if (!content) {
                            return;
                        }

                        if (content.id) {
                            processMethodCallback(content);
                        } else if (content.method) {
                            processEventCallback(content);
                        }
                    });

                    socketClient.onOpen(function (e) {
                        ariaNgLogService.debug('[aria2WebSocketRpcService.onOpen] websocket is opened', e);

                        if (context && context.connectionSuccessCallback) {
                            context.connectionSuccessCallback({
                                rpcUrl: rpcUrl
                            });
                        }
                    });

                    socketClient.onClose(function (e) {
                        ariaNgLogService.warn('[aria2WebSocketRpcService.onClose] websocket is closed', e);

                        if (ariaNgSettingService.getWebSocketReconnectInterval() > 0 && context && context.connectionWaitingToReconnectCallback) {
                            context.connectionWaitingToReconnectCallback({
                                rpcUrl: rpcUrl
                            });
                            planToReconnect(context);
                        } else if (context && context.connectionFailedCallback) {
                            context.connectionFailedCallback({
                                rpcUrl: rpcUrl
                            });
                        }
                    });
                } catch (ex) {
                    return {
                        success: false,
                        error: 'Cannot initialize WebSocket!',
                        exception: ex
                    }
                }
            }

            return {
                success: true,
                instance: socketClient
            };
        };

        var reconnect = function (context) {
            if (!context || !socketClient) {
                return;
            }

            if (context.connectionReconnectingCallback) {
                context.connectionReconnectingCallback({
                    rpcUrl: rpcUrl
                });
            }

            socketClient.reconnect();
        };

        var planToReconnect = function (context) {
            if (pendingReconnect) {
                ariaNgLogService.warn('[aria2WebSocketRpcService.planToReconnect] another reconnection is pending');
                return;
            }

            pendingReconnect = $timeout(function () {
                if (socketClient == null) {
                    ariaNgLogService.warn('[aria2WebSocketRpcService.planToReconnect] websocket is null');
                    pendingReconnect = null;
                    return;
                }

                if (socketClient.readyState === websocketStatusConnecting || socketClient.readyState === websocketStatusOpen) {
                    ariaNgLogService.warn('[aria2WebSocketRpcService.planToReconnect] websocket current state is already ' + socketClient.readyState);
                    pendingReconnect = null;
                    return;
                }

                reconnect(context);
                pendingReconnect = null;
            }, ariaNgSettingService.getWebSocketReconnectInterval());

            ariaNgLogService.debug('[aria2WebSocketRpcService.planToReconnect] next reconnection is pending in ' + ariaNgSettingService.getWebSocketReconnectInterval() + "ms");
        }

        return {
            request: function (context) {
                if (!context) {
                    return;
                }

                var client = getSocketClient({
                    connectionSuccessCallback: context.connectionSuccessCallback,
                    connectionFailedCallback: context.connectionFailedCallback,
                    connectionReconnectingCallback: context.connectionReconnectingCallback,
                    connectionWaitingToReconnectCallback: context.connectionWaitingToReconnectCallback
                });
                var uniqueId = context.uniqueId;
                var requestBody = angular.toJson(context.requestBody);

                ariaNgLogService.debug('[aria2WebSocketRpcService.request] ' + (context && context.requestBody && context.requestBody.method ? context.requestBody.method + ' ' : '') + 'request start', context);

                var deferred = $q.defer();

                sendIdStates[uniqueId] = {
                    context: context,
                    deferred: deferred
                };

                if (client.instance) {
                    client.instance.send(requestBody);
                } else {
                    deferred.reject({
                        success: false,
                        context: context
                    });

                    ariaNgLogService.debug('[aria2WebSocketRpcService.request] client error', client);
                    context.errorCallback(context.id, { message: client.error });
                }

                return deferred.promise;
            },
            reconnect: function (context) {
                reconnect(context);
            },
            on: function (eventName, callback) {
                var callbacks = eventCallbacks[eventName];

                if (!angular.isArray(callbacks)) {
                    callbacks = eventCallbacks[eventName] = [];
                }

                callbacks.push(callback);
            }
        };
    }]);
}());
