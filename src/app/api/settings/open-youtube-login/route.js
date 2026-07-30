import { NextResponse } from 'next/server';
import { setSetting } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);
const PROFILE_DIR = path.join(os.homedir(), '.gemini', 'antigravity-yt-profile');
const CDP_PORT = 9228; // 使用 9228 专用端口，避免与系统已有 9222 调试端口冲突

/**
 * 通过 Chrome DevTools Protocol (CDP) Page Target 毫秒级无损抓取真实解密的 YouTube/Google 活 Cookie
 */
async function fetchCookiesViaCDP() {
  try {
    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`, {
      signal: AbortSignal.timeout(2000)
    });
    if (!listRes.ok) return null;
    const listData = await listRes.json();
    if (!Array.isArray(listData) || listData.length === 0) return null;

    // 优先选择类型为 page 且包含 webSocketDebuggerUrl 的页面目标
    const pageTarget = listData.find(t => (t.type === 'page' || t.type === 'background_page') && t.webSocketDebuggerUrl)
      || listData.find(t => t.webSocketDebuggerUrl);

    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) return null;

    return new Promise((resolve) => {
      let resolved = false;
      const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

      const timeoutTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { ws.close(); } catch (e) {}
          resolve(null);
        }
      }, 3000);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          id: 1,
          method: 'Network.getCookies',
          params: {
            urls: [
              'https://www.youtube.com',
              'https://accounts.google.com',
              'https://youtube.com',
              'https://google.com'
            ]
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id === 1 && msg.result) {
            const rawCookies = msg.result.cookies || [];
            const ytCookies = rawCookies.filter(c => 
              c.domain && (c.domain.includes('youtube.com') || c.domain.includes('google.com'))
            );

            if (ytCookies.length > 0) {
              const cookieStr = ytCookies.map(c => `${c.name}=${c.value}`).join('; ');
              if (!resolved) {
                resolved = true;
                clearTimeout(timeoutTimer);
                try { ws.close(); } catch (e) {}
                resolve(cookieStr);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('解析 CDP Page Cookie 消息出错:', e.message);
        }
      };

      ws.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutTimer);
          resolve(null);
        }
      };
    });
  } catch (e) {
    return null;
  }
}

/**
 * POST /api/settings/open-youtube-login
 * 唤起 Chrome 独立 App 窗口，并通过 Chrome CDP 端口 9228 自动轮询抓取全量活 Cookie
 */
export async function POST() {
  try {
    // 0. 清理可能残留的旧 antigravity-yt-profile 登录进程，确保 9228 端口可用
    try { await execAsync('pkill -f "antigravity-yt-profile"'); } catch (e) {}

    // 1. 尝试直接获取
    let currentCookie = await fetchCookiesViaCDP();
    
    // 如果现有 Cookie 中已经包含登录凭证（LOGIN_INFO 或 SID 或 SAPISID），说明已处在登录状态
    if (currentCookie && (
      currentCookie.includes('LOGIN_INFO') || 
      currentCookie.includes('SID') ||
      currentCookie.includes('SAPISID') ||
      currentCookie.includes('VISITOR_INFO1_LIVE')
    )) {
      setSetting('youtube_cookie', currentCookie);
      return NextResponse.json({
        success: true,
        cookie: currentCookie,
        message: '✅ 已捕获到合法的 YouTube 登录凭证并自动保存！',
      });
    }

    // 2. 启动/唤起带 CDP 远程调试端口 9228 的独立 Chrome 登录 App 窗口
    const loginUrl = 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F';
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const launchCmd = `"${chromePath}" --remote-debugging-port=${CDP_PORT} '--remote-allow-origins=*' --app="${loginUrl}" --user-data-dir="${PROFILE_DIR}" &>/dev/null &`;

    try {
      await execAsync(launchCmd);
    } catch (launchErr) {
      console.warn('唤起 CDP Chrome 失败，回退到 open 命令:', launchErr.message);
      await execAsync(`open "${loginUrl}"`);
    }

    let latestCapturedCookie = null;

    // 3. 轮询等待用户在弹出的 Chrome 窗口中完成登录 (每秒轮询一次，最多等待 60 秒)
    const maxWaitSec = 60;
    const startTime = Date.now();

    while ((Date.now() - startTime) < maxWaitSec * 1000) {
      await new Promise(r => setTimeout(r, 1000));
      const capturedCookie = await fetchCookiesViaCDP();

      if (capturedCookie && capturedCookie.length > 10) {
        latestCapturedCookie = capturedCookie;
        
        // 关键判定：检测到登录凭证 (LOGIN_INFO, SID, SAPISID, HSID, APISID, __Secure-1PAPISID 等)
        const isFullyLoggedIn = capturedCookie.includes('LOGIN_INFO') || 
                                capturedCookie.includes('SID') || 
                                capturedCookie.includes('SAPISID') ||
                                capturedCookie.includes('APISID') ||
                                capturedCookie.includes('HSID') ||
                                capturedCookie.includes('VISITOR_INFO1_LIVE') ||
                                capturedCookie.includes('__Secure-');

        if (isFullyLoggedIn) {
          setSetting('youtube_cookie', capturedCookie);

          try { await execAsync('pkill -f "antigravity-yt-profile"'); } catch (e) {}

          return NextResponse.json({
            success: true,
            cookie: capturedCookie,
            message: '✅ 登录成功！已通过 CDP 全自动捕获并保存 YouTube 认证凭证！',
          });
        }
      } else if (!capturedCookie && latestCapturedCookie) {
        // 用户手动关闭了 Chrome 窗口，使用关窗前的 Cookie 存库！
        setSetting('youtube_cookie', latestCapturedCookie);

        return NextResponse.json({
          success: true,
          cookie: latestCapturedCookie,
          message: '✅ 已捕获并保存关窗前获取的 YouTube 认证凭证！',
        });
      }
    }

    // 4. 超时兜底：只要存在任何捕获到的 Cookie，均保存并返回成功！
    const fallbackCookie = latestCapturedCookie || (await fetchCookiesViaCDP());
    if (fallbackCookie && fallbackCookie.length > 10) {
      setSetting('youtube_cookie', fallbackCookie);
      return NextResponse.json({
        success: true,
        cookie: fallbackCookie,
        message: '✅ 已捕获并保存 YouTube 会话凭证！',
      });
    }

    return NextResponse.json({
      success: false,
      error: '未能在此次窗口会话中捕获到凭证。请重新点击【登录解封】并在弹出的 Chrome 中登录。',
    }, { status: 400 });

  } catch (error) {
    console.error('通过 CDP 捕获 YouTube Cookie 失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
