const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const net = require('net');
const fs = require('fs');

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

function getResourcePath(...segments) {
  if (app.isPackaged) {
    // In production, the standalone directory is unpacked from the asar
    return path.join(process.resourcesPath, 'app.asar.unpacked', ...segments);
  }
  // In development, point to the project root
  return path.join(__dirname, '..', ...segments);
}

function ensureEnvFile() {
  // In packaged mode, copy .env.local to the standalone directory if it exists in userData
  if (!app.isPackaged) return;

  const userDataPath = app.getPath('userData');
  const userEnvFile = path.join(userDataPath, '.env.local');
  const standaloneDir = getResourcePath('.next', 'standalone');
  const targetEnvFile = path.join(standaloneDir, '.env.local');

  // If user has a custom .env.local in userData, use it
  if (fs.existsSync(userEnvFile)) {
    fs.copyFileSync(userEnvFile, targetEnvFile);
    console.log('Copied .env.local from userData to standalone directory');
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    show: false, // Don't show until content is ready
  });

  const port = await findOpenPort();
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'data');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 拦截外部链接，使用系统浏览器打开，防止在 Electron 窗口内加载外部网址
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isLocal = url.startsWith(`http://127.0.0.1:${port}`) || 
                    url.startsWith(`http://localhost:${port}`) || 
                    (!app.isPackaged && (url.startsWith('http://127.0.0.1:3000') || url.startsWith('http://localhost:3000')));
    
    if (!isLocal && (url.startsWith('http:') || url.startsWith('https:'))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // 拦截 target="_blank" 的外部链接打开请求，使用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (app.isPackaged) {
    ensureEnvFile();

    const standaloneDir = getResourcePath('.next', 'standalone');
    const serverScript = path.join(standaloneDir, 'server.js');

    console.log('[ReaderQ] Starting Next.js server...');
    console.log('[ReaderQ] Standalone dir:', standaloneDir);
    console.log('[ReaderQ] Server script:', serverScript);
    console.log('[ReaderQ] Data dir:', dataDir);
    console.log('[ReaderQ] Port:', port);

    if (!fs.existsSync(serverScript)) {
      console.error('[ReaderQ] server.js not found at:', serverScript);
      app.quit();
      return;
    }

    // Use fork to run the server. In Electron, fork automatically uses the
    // Helper executable on macOS, which prevents a second dock icon from appearing.
    serverProcess = fork(serverScript, [], {
      cwd: standaloneDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: port.toString(),
        HOSTNAME: '127.0.0.1',
        DATA_DIR: dataDir,
      },
      silent: true, // pipes stdout and stderr to the parent (like stdio: ['ignore', 'pipe', 'pipe'])
    });

    serverProcess.stdout.on('data', (data) => {
      console.log('[Next.js]', data.toString().trim());
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Next.js ERR]', data.toString().trim());
    });

    serverProcess.on('error', (err) => {
      console.error('[ReaderQ] Failed to start Next.js server:', err);
    });

    serverProcess.on('exit', (code) => {
      console.log('[ReaderQ] Next.js server exited with code:', code);
    });

    // Wait for the server to be ready
    const waitForServer = (retries = 0) => {
      if (retries > 150) {
        // 30 seconds timeout (150 * 200ms)
        console.error('[ReaderQ] Server failed to start within 30 seconds');
        app.quit();
        return;
      }

      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.on('connect', () => {
        socket.destroy();
        console.log('[ReaderQ] Server is ready, loading UI...');
        mainWindow.loadURL(`http://127.0.0.1:${port}`);
        mainWindow.show();
      }).on('error', () => {
        socket.destroy();
        setTimeout(() => waitForServer(retries + 1), 200);
      }).on('timeout', () => {
        socket.destroy();
        setTimeout(() => waitForServer(retries + 1), 200);
      });
      socket.connect(port, '127.0.0.1');
    };

    waitForServer();
  } else {
    // In development, assume next dev is running on port 3000
    mainWindow.loadURL('http://127.0.0.1:3000');
    mainWindow.show();
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // 自动授权 local-fonts 权限以获取系统字体列表
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'local-fonts') {
      callback(true);
    } else {
      callback(false);
    }
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === 'local-fonts') {
      return true;
    }
    return false;
  });

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

app.on('will-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
  }
});
