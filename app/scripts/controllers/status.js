(function () {
    'use strict';

    angular.module('ariaNg').controller('Aria2StatusController', ['$rootScope', '$scope', '$timeout', 'ariaNgLocalizationService', 'ariaNgSettingService', 'aria2SettingService', function ($rootScope, $scope, $timeout, ariaNgLocalizationService, ariaNgSettingService, aria2SettingService) {
        $scope.context = {
            host: ariaNgSettingService.getCurrentRpcUrl(),
            serverStatus: null,
            isSupportReconnect: aria2SettingService.canReconnect()
        };

        $scope.reconnect = function () {
            if (!$scope.context.isSupportReconnect || ($rootScope.taskContext.rpcStatus !== 'Disconnected' && $rootScope.taskContext.rpcStatus !== 'Waiting to reconnect')) {
                return;
            }

            aria2SettingService.reconnect();
        };

        $scope.saveSession = function () {
            return aria2SettingService.saveSession(function (response) {
                if (response.success && response.data === 'OK') {
                    ariaNgLocalizationService.showOperationSucceeded('Session has been saved successfully.');
                }
            });
        };

        $scope.shutdown = function () {
            ariaNgLocalizationService.confirm('Confirm Shutdown', 'Are you sure you want to shutdown aria2?', 'warning', function (status) {
                return aria2SettingService.shutdown(function (response) {
                    if (response.success && response.data === 'OK') {
                        ariaNgLocalizationService.showOperationSucceeded('Aria2 has been shutdown successfully.');
                    }
                });
            }, true);
        };

        aria2SettingService.getAria2Status(function (response) {
            if (response.success) {
                $scope.context.serverStatus = response.data;
            }
        });

        $rootScope.loadPromise = $timeout(function () {}, 100);
    }]);
}());
