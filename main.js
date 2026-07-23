const { app, BrowserWindow, shell, session } = require("electron");
const path = require("path");
const { fileURLToPath } = require("url");

const APP_ID = "app.myra.music";
const DIST_ROOT = path.resolve(__dirname, "dist");
const ENTRY_FILE = path.join(DIST_ROOT, "index.html");

function isLocalAppUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "file:") return false;
    const target = path.resolve(fileURLToPath(parsed));
    return target === ENTRY_FILE || target.startsWith(`${DIST_ROOT}${path.sep}`);
  } catch {
    return false;
  }
}

function openExternalSafely(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:") {
      void shell.openExternal(parsed.toString());
    }
  } catch {
    // Ignore malformed navigation attempts.
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "MYRA",
    autoHideMenuBar: true,
    backgroundColor: "#05050b",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: !app.isPackaged,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  // The renderer is a local, sandboxed web app. OAuth/payment links are opened
  // in the operating system browser and can never replace the trusted renderer.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (isLocalAppUrl(url)) return;
    event.preventDefault();
    openExternalSafely(url);
  });
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());

  void win.loadFile(ENTRY_FILE);
}

app.setAppUserModelId(APP_ID);

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "notifications");
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
