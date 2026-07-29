#!/usr/bin/env node
/**
 * 通过 Chrome CDP 提取 YouTube/Google 全量活 Cookie
 * 核心策略：先通过 CDP 指示 Chrome 加载 youtube.com 页面，然后提取该页面的全量 Cookie
 * 用法: node extract-cdp-cookies.mjs [port]
 * 输出: JSON 到 stdout
 */

const CDP_PORT = process.argv[2] || 9222;

function connectWs(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      try { ws.close(); } catch (e) {}
      reject(new Error('WebSocket connect timeout'));
    }, 5000);
    ws.onopen = () => { clearTimeout(timeout); resolve(ws); };
    ws.onerror = (err) => { clearTimeout(timeout); reject(new Error('WebSocket error')); };
  });
}

function sendCommand(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 100000);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`CDP command '${method}' timeout`));
    }, 8000);

    const handler = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          clearTimeout(timeout);
          if (msg.error) {
            reject(new Error(msg.error.message));
          } else {
            resolve(msg.result);
          }
        }
      } catch (e) {}
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  try {
    // 1. 获取 page target 列表
    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`, { signal: AbortSignal.timeout(2000) });
    const targets = await listRes.json();
    
    // 找到第一个可用的 page target
    let pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!pageTarget) {
      console.log(JSON.stringify({ error: 'No page target found', cookies: null }));
      return;
    }

    // 2. 连接到 page target
    const ws = await connectWs(pageTarget.webSocketDebuggerUrl);

    // 3. 先启用 Network domain
    try {
      await sendCommand(ws, 'Network.enable');
    } catch (e) {
      // Network.enable 可能已经在运行，忽略
    }

    // 4. 导航到 YouTube 以确保 YouTube Cookie 可用
    const currentUrl = pageTarget.url || '';
    if (!currentUrl.includes('youtube.com')) {
      try {
        await sendCommand(ws, 'Page.navigate', { url: 'https://www.youtube.com' });
        // 等待页面加载
        await new Promise(r => setTimeout(r, 3000));
      } catch (e) {
        // 导航失败不影响 Cookie 提取
      }
    }

    // 5. 使用 Network.getAllCookies 提取全量 Cookie（适用于 page-level target）
    let result;
    try {
      result = await sendCommand(ws, 'Network.getAllCookies');
    } catch (e) {
      // 如果 Network.getAllCookies 不可用，尝试 Network.getCookies
      try {
        result = await sendCommand(ws, 'Network.getCookies', {
          urls: ['https://www.youtube.com', 'https://accounts.google.com']
        });
      } catch (e2) {
        try { ws.close(); } catch (e3) {}
        console.log(JSON.stringify({ error: `Cookie extraction failed: ${e.message}; ${e2.message}`, cookies: null }));
        return;
      }
    }

    const allCookies = result.cookies || [];
    const ytCookies = allCookies.filter(
      (c) => c.domain && (c.domain.includes('youtube.com') || c.domain.includes('google.com'))
    );
    const cookieStr = ytCookies.map((c) => `${c.name}=${c.value}`).join('; ');

    try { ws.close(); } catch (e) {}

    console.log(JSON.stringify({
      error: null,
      cookies: cookieStr || null,
      count: ytCookies.length,
      hasLogin: cookieStr.includes('LOGIN_INFO'),
      hasSID: ytCookies.some((c) => c.name === 'SID'),
    }));
  } catch (e) {
    console.log(JSON.stringify({ error: e.message, cookies: null }));
  }
}

main();
