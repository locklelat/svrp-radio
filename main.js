const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');

// Configure logging for updates
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 260,
        height: 620,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'ui/index.html'));
}

app.whenReady().then(() => {
    createWindow();

    // Check for updates automatically once the app is ready
    autoUpdater.checkForUpdatesAndNotify();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Optional update event listeners for debugging
autoUpdater.on('update-available', () => {
    log.info('A new update is available. Downloading...');
});

autoUpdater.on('update-downloaded', () => {
    log.info('Update downloaded; will install now');
    autoUpdater.quitAndInstall();
});

// Helper to convert web event codes to Electron accelerators
function getAccelerator(code) {
    if (!code) return null;
    if (code.includes('Control')) return 'Control';
    if (code.includes('Shift')) return 'Shift';
    if (code.includes('Alt')) return 'Alt';
    if (code === 'NumpadAdd' || code === 'Add') return 'numadd';
    if (code === 'NumpadSubtract' || code === 'Subtract') return 'numsub';
    if (code.startsWith('Key')) return code.replace('Key', '');
    if (code.startsWith('Digit')) return code.replace('Digit', '');
    return code;
}

ipcMain.on('register-shortcuts', (event, { pttKey, volUpKey, volDownKey }) => {
    // Clear out any old global shortcuts before registering new ones
    globalShortcut.unregisterAll();

    // Register PTT Key (Note: globalShortcut triggers on press down)
    const pttAccel = getAccelerator(pttKey);
    if (pttAccel) {
        globalShortcut.register(pttAccel, () => {
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (win && !win.isDestroyed()) {
                win.webContents.send('global-ptt-down');
            }
        });
    }

    // Register Volume Up Key
    const volUpAccel = getAccelerator(volUpKey);
    if (volUpAccel) {
        globalShortcut.register(volUpAccel, () => {
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (win && !win.isDestroyed()) {
                win.webContents.send('global-vol-up');
            }
        });
    }

    // Register Volume Down Key
    const volDownAccel = getAccelerator(volDownKey);
    if (volDownAccel) {
        globalShortcut.register(volDownAccel, () => {
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (win && !win.isDestroyed()) {
                win.webContents.send('global-vol-down');
            }
        });
    }
});

// Clean up shortcuts when app closes
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});