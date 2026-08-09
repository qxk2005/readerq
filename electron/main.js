const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const net = require('net');
const fs = require('fs');

let mainWindow;
let serverProcess;
let serverPort = null; // 保存服务端口，用于后续 API 调用

/**
 * 从 Next.js API 获取存储的 YouTube Cookie，并注入到 Electron session 中
 * 这样 YouTube 嵌入式播放器的 iframe 就能携带用户的 Google 登录凭证，
 * 避免被 YouTube 的防机器人检测拦截（"请登录以确认你不是机器人"）
 */
async function injectYouTubeCookies(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/settings/youtube-cookie-raw`);
    if (!response.ok) return;
    const data = await response.json();
    const cookieStr = data.youtube_cookie;
    if (!cookieStr || cookieStr.length < 10) {
      console.log('[ReaderQ] 未检测到 YouTube Cookie，跳过注入');
      return;
    }

    // 解析 cookie 字符串 (格式: "name1=value1; name2=value2; ...")
    const cookies = cookieStr.split(';').map(c => c.trim()).filter(Boolean);
    const defaultSes = session.defaultSession;
    let injectedCount = 0;

    for (const cookie of cookies) {
      const eqIdx = cookie.indexOf('=');
      if (eqIdx < 1) continue;
      const name = cookie.substring(0, eqIdx).trim();
      const value = cookie.substring(eqIdx + 1).trim();
      if (!name) continue;

      // 注入到 youtube.com 和 google.com 域
      const domains = ['.youtube.com', '.google.com'];
      for (const domain of domains) {
        try {
          await defaultSes.cookies.set({
            url: `https://www${domain}`,
            name,
            value,
            domain,
            path: '/',
            httpOnly: name.startsWith('__Secure-') || name === 'HSID' || name === 'SSID',
            secure: true,
            sameSite: 'no_restriction',
          });
          injectedCount++;
        } catch (e) {
          // 部分 cookie 注入失败是正常的（如格式不兼容）
        }
      }
    }

    console.log(`[ReaderQ] 已注入 ${injectedCount} 条 YouTube Cookie 到 Electron Session`);
  } catch (err) {
    console.warn('[ReaderQ] YouTube Cookie 注入失败:', err.message);
  }
}

function findOpenPort(preferredPort = 36123) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      const randomServer = net.createServer();
      randomServer.unref();
      randomServer.on('error', () => resolve(36123));
      randomServer.listen(0, '127.0.0.1', () => {
        const port = randomServer.address().port;
        randomServer.close(() => resolve(port));
      });
    });
    server.listen(preferredPort, '127.0.0.1', () => {
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
    // 允许内部特殊弹窗（例如 YouTube 登录）在应用内打开为 Modal/新窗口
    if (url.includes('readerq-internal-popup=1')) {
      return { 
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 600,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        }
      };
    }

    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (app.isPackaged) {
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
        serverPort = port;
        // 在加载 UI 之前注入 YouTube Cookie 到 Electron Session
        injectYouTubeCookies(port).then(() => {
          mainWindow.loadURL(`http://127.0.0.1:${port}`);
          mainWindow.show();
        });
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
    serverPort = 3000;
    // 开发模式也注入 YouTube Cookie
    injectYouTubeCookies(3000).then(() => {
      mainWindow.loadURL('http://127.0.0.1:3000');
      mainWindow.show();
      mainWindow.webContents.openDevTools();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // 绕过 Google 的“未开启 JavaScript”或“不安全浏览器”拦截
  app.userAgentFallback = app.userAgentFallback.replace(/Electron\/[\d\.]+\s/, '');

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

  // 当用户在设置中保存了新的 YouTube Cookie 后，
  // 窗口获取焦点时自动重新注入最新的 cookie 到 Electron Session
  app.on('browser-window-focus', () => {
    if (serverPort) {
      injectYouTubeCookies(serverPort).catch(() => {});
    }
  });

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
