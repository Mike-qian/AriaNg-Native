'use strict';

const os = require('os');
const electron = require('electron');
const electronLocalshortcut = require('electron-localshortcut');

const pkgfile = require('../package');

const core = require('./core');
const cmd = require('./cmd');
const config = require('./config/config');
const constants = require('./config/constants');
const menu = require('./components/menu');
const tray = require('./components/tray');
const file = require('./lib/file');
const page = require('./lib/page');
const websocket = require('./lib/websocket');
const ipcEvents = require('./ipc/events');
require('./ipc/methods');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

const singletonLock = app.requestSingleInstanceLock({
    argv: cmd.argv
});

if (!singletonLock) {
    app.quit();
    return;
}

let filePathInCommandLine = cmd.argv.file;

function isEnableCloseToHide() {
    return (tray.isEnabled() || os.platform() === 'darwin') && config.minimizedToTray;
}

global.settings = {
    version: pkgfile.version,
    ariaNgVersion: pkgfile['ariang-version'],
    isDevMode: cmd.argv.development,
    useCustomAppTitle: false
};

if (!app.isPackaged) {
    global.settings.isDevMode = true;
}

app.setAppUserModelId(pkgfile.appId);

if (os.platform() === 'win32' && !cmd.argv.classic) {
    global.settings.useCustomAppTitle = true;
}

if (os.platform() === 'darwin') {
    app.on('will-finish-launching', () => {
        app.on('open-file', (event, filePath) => {
            if (filePath) {
                filePathInCommandLine = filePath;
            }
        });
    });

    app.on('before-quit', () => {
        core.isConfirmExit = true;
    });

    app.on('activate', () => {
        if (core.mainWindow) {
            core.mainWindow.show();
        }
    });
}

app.on('window-all-closed', () => {
    app.quit();
});

app.on('second-instance', (event, argv, workingDirectory, additionalData) => {
    if (core.mainWindow) {
        if (core.mainWindow.isMinimized()) {
            core.mainWindow.restore();
        } else if (!core.mainWindow.isVisible()) {
            core.mainWindow.show();
        }

        core.mainWindow.focus();

        let filePath = null;

        if (additionalData && additionalData.argv) {
            filePath = additionalData.argv.file;
        }

        if (!filePath) {
            filePath = cmd.parseFilePath(argv);
        }

        if (filePath && file.isContainsSupportedFileArg(filePath)) {
            ipcEvents.notifyRenderProcessNewNewTaskFromFileAfterViewLoaded(filePath);
            ipcEvents.notifyRenderProcessNavigateToNewTask();
        }
    }
});

app.on('ready', () => {
    core.mainWindow = new BrowserWindow({
        title: 'AriaNg Native',
        width: config.width,
        height: config.height,
        minWidth: 800,
        minHeight: 400,
        fullscreenable: false,
        frame: !global.settings.useCustomAppTitle,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    let displays = electron.screen.getAllDisplays();
    let isLastPositionInScreen = false;

    if (config.x >= 0 && config.y >= 0) {
        for (let i = 0; i < displays.length; i++) {
            let x1 = displays[i].bounds.x;
            let x2 = x1 + displays[i].workAreaSize.width;
            let y1 = displays[i].bounds.y;
            let y2 = y1 + displays[i].workAreaSize.height;

            if (config.x >= x1 && config.x <= x2 && config.y >= y1 && config.y <= y2) {
                isLastPositionInScreen = true;
                break;
            }
        }
    }

    if (config.defaultPosition === 'last-position' && isLastPositionInScreen) {
        core.mainWindow.setPosition(config.x, config.y);
    } else if (config.defaultPosition === 'screen-center') {
        core.mainWindow.center();
    }

    if (config.maximized) {
        core.mainWindow.maximize();
    }

    if (global.settings.isDevMode) {
        electronLocalshortcut.register(core.mainWindow, 'F12', () => {
            core.mainWindow.webContents.openDevTools();
        });
    }

    menu.init();
    tray.init();

    if (file.isContainsSupportedFileArg(filePathInCommandLine)) {
        ipcEvents.notifyRenderProcessNewNewTaskFromFileAfterViewLoaded(filePathInCommandLine);
        core.mainWindow.loadURL(page.getPageFullUrl(constants.ariaNgPageLocations.NewTask));
    } else {
        core.mainWindow.loadURL(page.getPageFullUrl());
    }

    core.mainWindow.once('ready-to-show', () => {
        core.mainWindow.show();
    });

    core.mainWindow.on('resize', () => {
        let sizes = core.mainWindow.getSize();
        config.width = sizes[0];
        config.height = sizes[1];
    });

    core.mainWindow.on('maximize', () => {
        config.maximized = core.mainWindow.isMaximized();
        ipcEvents.notifyRenderProcessWindowMaximized(core.mainWindow.isMaximized());
    });

    core.mainWindow.on('unmaximize', () => {
        config.maximized = core.mainWindow.isMaximized();
        ipcEvents.notifyRenderProcessWindowUnmaximized(core.mainWindow.isMaximized());
    });

    core.mainWindow.on('move', () => {
        let positions = core.mainWindow.getPosition();
        config.x = positions[0];
        config.y = positions[1];
    });

    core.mainWindow.on('close', (event) => {
        if (isEnableCloseToHide() && !core.isConfirmExit) {
            event.preventDefault();
            core.mainWindow.hide();
            event.returnValue = false;
        }
    });

    core.mainWindow.on('closed', () => {
        try {
            if (!config.maximized) {
                if (config.width > 0) {
                    config.save('width');
                }

                if (config.height > 0) {
                    config.save('height');
                }

                if (config.x > 0 && config.y > 0) {
                    config.save('x');
                    config.save('y');
                }
            }

            config.save('maximized');
        } catch (ex) {
            ; // Do Nothing
        }

        core.mainWindow = null;
    });

    ipcEvents.onRenderProcessElectronServiceInited((event) => {
        websocket.init();
    });

    ipcEvents.onRenderProcessNewDropFile((event, arg) => {
        if (!arg) {
            return;
        }

        let filePath = arg.filePath;
        let location = arg.location;

        if (location.indexOf('/new') === 0) {
            ipcEvents.notifyRenderProcessNewTaskFromFile(filePath);
        } else {
            ipcEvents.notifyRenderProcessNewNewTaskFromFileAfterViewLoaded(filePath);
            ipcEvents.notifyRenderProcessNavigateToNewTask();
        }
    });

    ipcEvents.onRenderProcessNewDropText((event, arg) => {
        if (!arg) {
            return;
        }

        let text = arg.text;
        let location = arg.location;

        if (location.indexOf('/new') === 0) {
            ipcEvents.notifyRenderProcessNewTaskFromText(text);
        } else {
            ipcEvents.notifyRenderProcessNewNewTaskFromTextAfterViewLoaded(text);
            ipcEvents.notifyRenderProcessNavigateToNewTask();
        }
    });
});
