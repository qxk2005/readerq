const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const net = require('net');

let mainWindow;
let serverProcess;

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset' // Mac style
  });

  const port = await findOpenPort();
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'data');
  
  if (app.isPackaged) {
    // In production, run the Next.js standalone server
    const serverPath = path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone', 'server.js');
    
    serverProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: port.toString(),
        HOSTNAME: '127.0.0.1',
        ELECTRON_RUN_AS_NODE: '1',
        DATA_DIR: dataDir
      }
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start Next.js server:', err);
    });

    // Simple wait loop to ensure the server is ready before loading
    const checkServer = () => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.on('connect', () => {
        socket.destroy();
        mainWindow.loadURL(`http://127.0.0.1:${port}`);
      }).on('error', () => {
        socket.destroy();
        setTimeout(checkServer, 200);
      }).on('timeout', () => {
        socket.destroy();
        setTimeout(checkServer, 200);
      });
      socket.connect(port, '127.0.0.1');
    };
    
    checkServer();

  } else {
    // In development, assume next dev is running on port 3000
    mainWindow.loadURL('http://127.0.0.1:3000');
    // Open DevTools in dev mode
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
