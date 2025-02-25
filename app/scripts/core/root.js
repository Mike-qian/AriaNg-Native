(function () {
    'use strict';

    angular.module('ariaNg').run(['$window', '$rootScope', '$location', '$document', '$timeout', 'ariaNgCommonService', 'ariaNgLocalizationService', 'ariaNgLogService', 'ariaNgSettingService', 'aria2TaskService', 'ariaNgNativeElectronService', function ($window, $rootScope, $location, $document, $timeout, ariaNgCommonService, ariaNgLocalizationService, ariaNgLogService, ariaNgSettingService, aria2TaskService, ariaNgNativeElectronService) {
        var autoRefreshAfterPageLoad = false;

        var isUrlMatchUrl2 = function (url, url2) {
            if (url === url2) {
                return true;
            }

            var index = url2.indexOf(url);

            if (index !== 0) {
                return false;
            }

            var lastPart = url2.substring(url.length);

            if (lastPart.indexOf('/') === 0) {
                return true;
            }

            return false;
        };

        var setLightTheme = function () {
            $rootScope.currentTheme = 'light';
            angular.element('body').removeClass('theme-dark');
        };

        var setDarkTheme = function () {
            $rootScope.currentTheme = 'dark';
            angular.element('body').addClass('theme-dark');
        };

        var setThemeBySystemSettings = function () {
            if (!ariaNgSettingService.isBrowserSupportDarkMode()) {
                setLightTheme();
                return;
            }

            var matchPreferColorScheme = $window.matchMedia('(prefers-color-scheme: dark)');

            ariaNgLogService.info('[root.setThemeBySystemSettings] system uses ' + (matchPreferColorScheme.matches ? 'dark' : 'light') + ' theme');

            if (matchPreferColorScheme.matches) {
                setDarkTheme();
            } else {
                setLightTheme();
            }
        };

        var initTheme = function () {
            if (ariaNgSettingService.getTheme() === 'system') {
                setThemeBySystemSettings();
            } else if (ariaNgSettingService.getTheme() === 'dark') {
                setDarkTheme();
            } else {
                setLightTheme();
            }
        };

        var initCheck = function () {
            var browserFeatures = ariaNgSettingService.getBrowserFeatures();

            if (!browserFeatures.localStroage) {
                ariaNgLogService.warn('[root.initCheck] LocalStorage is not supported!');
            }

            if (!browserFeatures.cookies) {
                ariaNgLogService.warn('[root.initCheck] Cookies is not supported!');
            }

            if (!ariaNgSettingService.isBrowserSupportStorage()) {
                angular.element('body').prepend('<div class="disable-overlay"></div>');
                angular.element('.main-sidebar').addClass('blur');
                angular.element('.navbar').addClass('blur');
                angular.element('.content-body').addClass('blur');
                ariaNgLocalizationService.notifyInPage('', 'You cannot use AriaNg because this browser does not meet the minimum requirements for data storage.', {
                    type: 'error',
                    delay: false
                });

                throw new Error('You cannot use AriaNg because this browser does not meet the minimum requirements for data storage.');
            }
        };

        var initNavbar = function () {
            angular.element('section.sidebar > ul > li[data-href-match] > a').click(function () {
                angular.element('section.sidebar > ul li').removeClass('active');
                angular.element(this).parent().addClass('active');
            });

            angular.element('section.sidebar > ul > li.treeview > ul.treeview-menu > li[data-href-match] > a').click(function () {
                angular.element('section.sidebar > ul li').removeClass('active');
                angular.element(this).parent().addClass('active').parent().parent().addClass('active');
            });
        };

        var setNavbarSelected = function (location) {
            angular.element('section.sidebar > ul li').removeClass('active');
            angular.element('section.sidebar > ul > li[data-href-match]').each(function (index, element) {
                var match = angular.element(element).attr('data-href-match');

                if (isUrlMatchUrl2(match, location)) {
                    angular.element(element).addClass('active');
                }
            });

            angular.element('section.sidebar > ul > li.treeview > ul.treeview-menu > li[data-href-match]').each(function (index, element) {
                var match = angular.element(element).attr('data-href-match');

                if (isUrlMatchUrl2(match, location)) {
                    angular.element(element).addClass('active').parent().parent().addClass('active');
                }
            });
        };

        var initContentWrapper = function () {
            //copy from AdminLTE app.js
            var defaultNavbarWithAppTitleHeight = 74; // defined in "min-height" of ".custom-app-title .main-header .navbar" in app-title.css
            var defaultNavbarHeight = 50; // defined in "min-height" of ".main-header .navbar" in AdminLTE.css
            var defaultFooterHeight = 1 + 15 + 15 + 17; // defined in "border-top" of ".main-footer" in AdminLTE.css, "padding" of ".main-footer" in AdminLTE.css and "line-height" of ".skin-aria-ng .main-footer > .navbar > .navbar-toolbar > .nav > li > a" in default.css;

            var windowHeight = $(window).height();
            var headerHeight  = $('.main-header').outerHeight() || (ariaNgNativeElectronService.useCustomAppTitle() ? defaultNavbarWithAppTitleHeight : defaultNavbarHeight);
            var footerHeight = $('.main-footer').outerHeight() || defaultFooterHeight;
            var neg = headerHeight + footerHeight;

            $('.content-wrapper').css('min-height', windowHeight - footerHeight);
            $('.content-body').css('height', windowHeight - neg);
        };

        var initFileDragSupport = function () {
            var getDropFile = function (e) {
                if (!e || !e.dataTransfer) {
                    return null;
                }

                if (e.dataTransfer.items && e.dataTransfer.items[0] && e.dataTransfer.items[0].kind === 'file') {
                    return e.dataTransfer.items[0].getAsFile();
                } else if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    return  e.dataTransfer.files[0];
                } else {
                    return null;
                }
            };

            var getDropText = function (e) {
                if (!e || !e.dataTransfer) {
                    return null;
                }

                return e.dataTransfer.getData('text');
            };

            var dropzone = angular.element('#dropzone');
            var dropzoneFileZone = angular.element('#dropzone-filezone');

            angular.element($window).on('dragenter', function (e) {
                dropzone.show();
                e.preventDefault();
            });

            dropzoneFileZone.on('drag dragstart dragend dragover dragenter dragleave drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
            }).on('dragleave dragend drop', function() {
                dropzone.hide();
            }).on('drop', function(e) {
                var file = getDropFile(e.originalEvent);

                if (file) {
                    ariaNgNativeElectronService.notifyMainProcessorNewDropFile({
                        filePath: file.path,
                        location: $location.url()
                    });
                    return;
                }

                var text = getDropText(e.originalEvent);

                if (text) {
                    ariaNgNativeElectronService.notifyMainProcessorNewDropText({
                        text: text,
                        location: $location.url()
                    });
                }
            });
        };

        var showSidebar = function () {
            angular.element('body').removeClass('sidebar-collapse').addClass('sidebar-open');
        };

        var hideSidebar = function () {
            angular.element('body').addClass('sidebar-collapse').removeClass('sidebar-open');
        };

        var isSidebarShowInSmallScreen = function () {
            return angular.element('body').hasClass('sidebar-open');
        };

        var toggleMaximizeButton = function () {
            angular.element('#native-title-maximize-icon').addClass('fa-window-maximize').removeClass('fa-window-restore');
            angular.element('#native-title-maximize-btn').attr('title', ariaNgLocalizationService.getLocalizedText('Maximize'));
        };

        var toggleRestoreButton = function () {
            angular.element('#native-title-maximize-icon').addClass('fa-window-restore').removeClass('fa-window-maximize');
            angular.element('#native-title-maximize-btn').attr('title', ariaNgLocalizationService.getLocalizedText('Restore Down'));
        };

        $rootScope.currentTheme = 'light';

        $rootScope.searchContext = {
            text: ''
        };

        $rootScope.taskContext = {
            rpcStatus: 'Connecting',
            list: [],
            selected: {},
            enableSelectAll: false,
            getSelectedTaskIds: function () {
                var result = [];

                if (!this.list || !this.selected || this.list.length < 1) {
                    return result;
                }

                for (var i = 0; i < this.list.length; i++) {
                    var task = this.list[i];

                    if (this.selected[task.gid]) {
                        result.push(task.gid);
                    }
                }

                return result;
            },
            getSelectedTasks: function () {
                var result = [];

                if (!this.list || !this.selected || this.list.length < 1) {
                    return result;
                }

                for (var i = 0; i < this.list.length; i++) {
                    var task = this.list[i];

                    if (this.selected[task.gid]) {
                        result.push(task);
                    }
                }

                return result;
            },
            isAllSelected: function () {
                var isAllSelected = true;

                for (var i = 0; i < this.list.length; i++) {
                    var task = this.list[i];

                    if (!$rootScope.filterTask(task)) {
                        continue;
                    }

                    if (!this.selected[task.gid]) {
                        isAllSelected = false;
                        break;
                    }
                }

                return isAllSelected;
            },
            hasRetryableTask: function () {
                for (var i = 0; i < this.list.length; i++) {
                    var task = this.list[i];

                    if (!$rootScope.filterTask(task)) {
                        continue;
                    }

                    if ($rootScope.isTaskRetryable(task)) {
                        return true;
                    }
                }

                return false;
            },
            hasCompletedTask: function () {
                for (var i = 0; i < this.list.length; i++) {
                    var task = this.list[i];

                    if (!$rootScope.filterTask(task)) {
                        continue;
                    }

                    if (task.status === 'complete') {
                        return true;
                    }
                }

                return false;
            },
            selectAll: function () {
                if (!this.list || !this.selected || this.list.length < 1) {
                    return;
                }

                if (!this.enableSelectAll) {
                    return;
                }

                var isAllSelected = this.isAllSelected();

                for (var i = 0; i < this.list.length; i++) {
                    var task = this.list[i];

                    if (!$rootScope.filterTask(task)) {
                        continue;
                    }

                    this.selected[task.gid] = !isAllSelected;
                }
            },
            selectAllFailed: function () {
                if (!this.list || !this.selected || this.list.length < 1) {
                    return;
                }

                if (!this.enableSelectAll) {
                    return;
                }

                var isAllFailedSelected = true;

                for (var i = 0; i < this.list.length; i++) {
                    var task = this.list[i];

                    if (!$rootScope.filterTask(task)) {
                        continue;
                    }

                    if (!$rootScope.isTaskRetryable(task)) {
                        continue;
                    }

                    if (!this.selected[task.gid]) {
                        isAllFailedSelected = false;
                    }
                }

                for (var i = 0; i < this.list.length; i++) {
                    var task = this.list[i];

                    if (!$rootScope.filterTask(task)) {
                        continue;
                    }

                    if (!$rootScope.isTaskRetryable(task)) {
                        this.selected[task.gid] = false;
                        continue;
                    }

                    this.selected[task.gid] = !isAllFailedSelected;
                }
            },
            selectAllCompleted: function () {
                if (!this.list || !this.selected || this.list.length < 1) {
                    return;
                }

                if (!this.enableSelectAll) {
                    return;
                }

                var isAllFailedSelected = true;

                for (var i = 0; i < this.list.length; i++) {
                    var task = this.list[i];

                    if (!$rootScope.filterTask(task)) {
                        continue;
                    }

                    if (task.status !== 'complete') {
                        continue;
                    }

                    if (!this.selected[task.gid]) {
                        isAllFailedSelected = false;
                    }
                }

                for (var i = 0; i < this.list.length; i++) {
                    var task = this.list[i];

                    if (!$rootScope.filterTask(task)) {
                        continue;
                    }

                    if (task.status !== 'complete') {
                        this.selected[task.gid] = false;
                        continue;
                    }

                    this.selected[task.gid] = !isAllFailedSelected;
                }
            }
        };

        $rootScope.filterTask = function (task) {
            if (!task || !angular.isString(task.taskName)) {
                return false;
            }

            if (!$rootScope.searchContext || !$rootScope.searchContext.text) {
                return true;
            }

            return (task.taskName.toLowerCase().indexOf($rootScope.searchContext.text.toLowerCase()) >= 0);
        };

        $rootScope.isTaskRetryable = function (task) {
            return task && task.status === 'error' && task.errorDescription && !task.bittorrent;
        };

        $rootScope.keydownActions = {};

        $rootScope.swipeActions = {
            leftSwipe: function () {
                if (!ariaNgSettingService.getSwipeGesture()) {
                    return;
                }

                if (isSidebarShowInSmallScreen()) {
                    hideSidebar();
                    return;
                }

                if (!this.extendLeftSwipe ||
                    (angular.isFunction(this.extendLeftSwipe) && !this.extendLeftSwipe())) {
                    hideSidebar();
                }
            },
            rightSwipe: function () {
                if (!ariaNgSettingService.getSwipeGesture()) {
                    return;
                }

                if (!this.extendRightSwipe ||
                    (angular.isFunction(this.extendRightSwipe) && !this.extendRightSwipe())) {
                    showSidebar();
                }
            }
        };

        $rootScope.refreshPage = function () {
            $window.location.reload();
        };

        $rootScope.setAutoRefreshAfterPageLoad = function () {
            autoRefreshAfterPageLoad = true;
        };

        $rootScope.setTheme = function (theme) {
            if (theme === 'system') {
                setThemeBySystemSettings();
            } else if (theme === 'dark') {
                setDarkTheme();
            } else {
                setLightTheme();
            }
        };

        $rootScope.useCustomAppTitle = ariaNgNativeElectronService.useCustomAppTitle();

        ariaNgNativeElectronService.getWindowMaximizedAsync(function (maximized) {
            if (maximized) {
                toggleRestoreButton();
            } else {
                toggleMaximizeButton();
            }
        });

        $window.addEventListener('keydown', function (event) {
            if (!ariaNgSettingService.getKeyboardShortcuts()) {
                return;
            }

            var keyCode = event.keyCode || event.which || event.charCode;

            if ((event.code === 'KeyA' || keyCode === 65) && (event.ctrlKey || event.metaKey)) { // Ctrl+A / Command+A
                if (angular.isFunction($rootScope.keydownActions.selectAll)) {
                    $rootScope.keydownActions.selectAll();
                }
            } else if (event.code === 'Delete' || keyCode === 46) { // Delete
                if (angular.isFunction($rootScope.keydownActions.delete)) {
                    $rootScope.keydownActions.delete();
                }
            }
        }, true);

        ariaNgNativeElectronService.onMainWindowMaximize(function () {
            toggleRestoreButton();
        });

        ariaNgNativeElectronService.onMainWindowUnmaximize(function () {
            toggleMaximizeButton();
        });

        ariaNgNativeElectronService.onMainProcessNavigateTo(function (event, routeUrl) {
            $location.path(routeUrl);
        });

        ariaNgNativeElectronService.onMainProcessShowError(function (event, message) {
            ariaNgLocalizationService.showError(message);
        });

        ariaNgSettingService.setDebugMode(ariaNgNativeElectronService.isDevMode());

        ariaNgSettingService.onApplicationCacheUpdated(function () {
            ariaNgLocalizationService.notifyInPage('', 'Application cache has been updated, please reload the page for the changes to take effect.', {
                delay: false,
                type: 'info',
                templateUrl: 'views/notification-reloadable.html'
            });
        });

        ariaNgSettingService.onFirstAccess(function () {
            ariaNgLocalizationService.notifyInPage('', 'Tap to configure and get started with AriaNg.', {
                delay: false,
                onClose: function () {
                    $location.path('/settings/ariang');
                }
            });
        });

        aria2TaskService.onFirstSuccess(function (event) {
            ariaNgLocalizationService.notifyInPage('', 'is connected', {
                type: 'success',
                contentPrefix: event.rpcName + ' '
            });
        });

        aria2TaskService.onConnectionSuccess(function () {
            $timeout(function () {
                if ($rootScope.taskContext.rpcStatus !== 'Connected') {
                    $rootScope.taskContext.rpcStatus = 'Connected';
                }
            });
        });

        aria2TaskService.onConnectionFailed(function () {
            $timeout(function () {
                if ($rootScope.taskContext.rpcStatus !== 'Disconnected') {
                    $rootScope.taskContext.rpcStatus = 'Disconnected';
                }
            });
        });

        aria2TaskService.onConnectionReconnecting(function () {
            $timeout(function () {
                if ($rootScope.taskContext.rpcStatus !== 'Reconnecting') {
                    $rootScope.taskContext.rpcStatus = 'Reconnecting';
                }
            });
        });

        aria2TaskService.onConnectionWaitingToReconnect(function () {
            $timeout(function () {
                if ($rootScope.taskContext.rpcStatus !== 'Waiting to reconnect') {
                    $rootScope.taskContext.rpcStatus = 'Waiting to reconnect';
                }
            });
        });

        aria2TaskService.onTaskCompleted(function (event) {
            ariaNgLocalizationService.notifyTaskComplete(event.task);
        });

        aria2TaskService.onBtTaskCompleted(function (event) {
            ariaNgLocalizationService.notifyBtTaskComplete(event.task);
        });

        aria2TaskService.onTaskErrorOccur(function (event) {
            ariaNgLocalizationService.notifyTaskError(event.task);
        });

        $rootScope.$on('$locationChangeStart', function (event) {
            ariaNgCommonService.closeAllDialogs();

            $rootScope.loadPromise = null;

            delete $rootScope.keydownActions.selectAll;
            delete $rootScope.keydownActions.delete;
            delete $rootScope.swipeActions.extendLeftSwipe;
            delete $rootScope.swipeActions.extendRightSwipe;

            if (angular.isArray($rootScope.taskContext.list) && $rootScope.taskContext.list.length > 0) {
                $rootScope.taskContext.list.length = 0;
            }

            if (angular.isObject($rootScope.taskContext.selected)) {
                $rootScope.taskContext.selected = {};
            }

            $rootScope.taskContext.enableSelectAll = false;
        });

        $rootScope.$on('$routeChangeStart', function (event, next, current) {
            var location = $location.path();

            setNavbarSelected(location);
            $document.unbind('keypress');
        });

        $rootScope.$on('$viewContentLoaded', function () {
            ariaNgNativeElectronService.notifyMainProcessViewLoaded($location.path());
        });

        $rootScope.$on('$translateChangeSuccess', function(event, current, previous) {
            ariaNgNativeElectronService.setMainWindowLanguage();
        });

        if (ariaNgSettingService.isBrowserSupportDarkMode()) {
            var matchPreferColorScheme = $window.matchMedia('(prefers-color-scheme: dark)');
            matchPreferColorScheme.addEventListener('change', function (e) {
                ariaNgLogService.info('[root] system switches to ' + (e.matches ? 'dark' : 'light') + ' theme');

                if (ariaNgSettingService.getTheme() === 'system') {
                    if (e.matches) {
                        setDarkTheme();
                    } else {
                        setLightTheme();
                    }
                }
            });
        }

        $rootScope.$on('$locationChangeSuccess', function (event, newUrl) {
            if (autoRefreshAfterPageLoad) {
                $window.location.reload();
            }
        });

        initTheme();
        initCheck();
        initNavbar();
        initContentWrapper();
        initFileDragSupport();
    }]);
}());
