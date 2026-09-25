const { app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');

// Configure logging for updates
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 240,
        height: 500,
        frame: false,
        transparent: true,
        resizable: false,
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

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 240,
        height: 500,
        frame: false,          // Removes standard Windows title bar
        transparent: true,     // Keeps transparent background
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Loads index.html from the new 'ui' folder
    mainWindow.loadFile(path.join(__dirname, 'ui/index.html'));
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});