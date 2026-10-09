// Electron shell for the Windows desktop app. Loads the built web app (dist/)
// from disk; progress is stored in the app's own userData folder.
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

if (!app.requestSingleInstanceLock()) app.quit();

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    title: 'Vocab Quest',
    backgroundColor: '#f4f1ff',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  // Links that leave the app open in the user's browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
