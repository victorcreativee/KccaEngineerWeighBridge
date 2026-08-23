import { app, BrowserWindow, shell } from "electron";

const BUYALA_URL = "https://buyala-weighbridge.web.app/";

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 920,
    minHeight: 640,
    title: "Buyala Waste Operations",
    backgroundColor: "#f4f7f5",
    webPreferences: {
      partition: "persist:buyala-operations",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(BUYALA_URL)) { event.preventDefault(); if (url.startsWith("https://")) void shell.openExternal(url); }
  });
  window.loadURL(BUYALA_URL).catch(() => {
    const fallback = `<!doctype html><html><meta name="viewport" content="width=device-width"><style>body{font:16px system-ui;background:#f4f7f5;color:#173128;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:540px;background:white;padding:32px;border-radius:14px;border:1px solid #d9e2dd}button{background:#176b43;color:white;border:0;padding:12px 16px;border-radius:8px;font-weight:700}</style><div class="card"><h1>Buyala is not available offline yet</h1><p>Connect this computer to the internet once, open Buyala, sign in and complete the offline readiness check. After that, the application can reopen from its saved offline files.</p><button onclick="location.href='${BUYALA_URL}'">Try again</button></div></html>`;
    window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallback)}`);
  });
}

app.setAppUserModelId("app.buyalaweighbridge.desktop");
app.whenReady().then(() => { createWindow(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
