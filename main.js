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
    autoUpdater.checkForUpdatesAndNotify();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

autoUpdater.on('update-available', () => {
    log.info('A new update is available. Downloading...');
});

autoUpdater.on('update-downloaded', () => {
    log.info('Update downloaded; will install now');
    autoUpdater.quitAndInstall();
});

function getAccelerator(code) {
    if (!code) return null;

    // Handle combinations like Alt+ArrowUp / Alt+ArrowDown or Control+
    if (code.includes('+')) {
        let parts = code.split('+');
        let modifier = parts[0]; // Control or Alt
        let baseKey = parts[1];
        
        if (baseKey === 'ArrowUp' || baseKey === 'Up') baseKey = 'Up';
        if (baseKey === 'ArrowDown' || baseKey === 'Down') baseKey = 'Down';
        if (baseKey === 'ArrowLeft' || baseKey === 'Left') baseKey = 'Left';
        if (baseKey === 'ArrowRight' || baseKey === 'Right') baseKey = 'Right';
        
        if (baseKey.startsWith('Key')) baseKey = baseKey.replace('Key', '');
        if (baseKey.startsWith('Digit')) baseKey = baseKey.replace('Digit', '');
        
        return `${modifier}+${baseKey}`;
    }

    // Standard single-key handling
    if (code.includes('Control') || code.includes('Shift') || code.includes('Alt')) {
        return null; 
    }
    if (code === 'NumpadAdd' || code === 'Add') return 'numadd';
    if (code === 'NumpadSubtract' || code === 'Subtract') return 'numsub';
    if (code.startsWith('Key')) code = code.replace('Key', '');
    if (code.startsWith('Digit')) code = code.replace('Digit', '');
    return code;
}

ipcMain.on('close-app', () => {
    app.quit();
});

ipcMain.on('register-shortcuts', (event, { pttKey, volUpKey, volDownKey, chanUpKey, chanDownKey }) => {
    globalShortcut.unregisterAll();

    // Register PTT Key (Using your previous working pulse setup or click setup)
    const pttAccel = getAccelerator(pttKey);
    if (pttAccel) {
        try {
            globalShortcut.register(pttAccel, () => {
                const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
                if (win && !win.isDestroyed()) {
                    win.webContents.send('global-ptt-pulse');
                }
            });
        } catch (err) {
            console.log(`Could not register global shortcut for PTT:`, err.message);
        }
    }

    // Register Volume Up Key
    const volUpAccel = getAccelerator(volUpKey);
    if (volUpAccel) {
        try {
            globalShortcut.register(volUpAccel, () => {
                const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
                if (win && !win.isDestroyed()) {
                    win.webContents.send('global-vol-up');
                }
            });
        } catch (err) {
            console.log(`Could not register Vol Up shortcut:`, err.message);
        }
    }

    // Register Volume Down Key
    const volDownAccel = getAccelerator(volDownKey);
    if (volDownAccel) {
        try {
            globalShortcut.register(volDownAccel, () => {
                const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
                if (win && !win.isDestroyed()) {
                    win.webContents.send('global-vol-down');
                }
            });
        } catch (err) {
            console.log(`Could not register Vol Down shortcut:`, err.message);
        }
    }

    // Register Channel Up Key
    const chanUpAccel = getAccelerator(chanUpKey);
    if (chanUpAccel) {
        try {
            globalShortcut.register(chanUpAccel, () => {
                const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
                if (win && !win.isDestroyed()) {
                    win.webContents.send('global-chan-up');
                }
            });
        } catch (err) {
            console.log(`Could not register Channel Up shortcut:`, err.message);
        }
    }

    // Register Channel Down Key
    const chanDownAccel = getAccelerator(chanDownKey);
    if (chanDownAccel) {
        try {
            globalShortcut.register(chanDownAccel, () => {
                const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
                if (win && !win.isDestroyed()) {
                    win.webContents.send('global-chan-down');
                }
            });
        } catch (err) {
            console.log(`Could not register Channel Down shortcut:`, err.message);
        }
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});