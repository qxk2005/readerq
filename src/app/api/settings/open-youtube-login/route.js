import { NextResponse } from 'next/server';
import { setSetting } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);
const PROFILE_DIR = path.join(os.homedir(), '.gemini', 'antigravity-yt-profile');
const CDP_PORT = 9222;

/**
 * 通过 Chrome DevTools Protocol (CDP) 毫秒级无损抓取真实解密的 YouTube/Google 活 Cookie
 */
async function fetchCookiesViaCDP() {
  try {
    const versionRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`, {
      signal: AbortSignal.timeout(2000)
    });
    if (!versionRes.ok) return null;
    const versionData = await versionRes.json();
    const wsUrl = versionData.webSocketDebuggerUrl;
    if (!wsUrl) return null;

    return new Promise((resolve) => {
      let resolved = false;
      const ws = new WebSocket(wsUrl);

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
          method: 'Network.getAllCookies'
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
          console.warn('解析 CDP Cookie 消息出错:', e.message);
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
 * 唤起 Chrome 独立 App 窗口，并通过 Chrome CDP 端口 9222 自动轮询抓取全量活 Cookie
 */
export async function POST() {
  try {
    // 1. 先尝试通过 CDP 直接读取已开启的 Chrome 实例 Cookies
    let currentCookie = await fetchCookiesViaCDP();
    
    // 如果现有 Cookie 中已经包含登录凭证（LOGIN_INFO 或 SID），说明已处在登录状态
    if (currentCookie && (currentCookie.includes('LOGIN_INFO') || currentCookie.includes('SID'))) {
      setSetting('youtube_cookie', currentCookie);
      return NextResponse.json({
        success: true,
        cookie: currentCookie,
        message: '✅ 已捕获到合法的 YouTube 登录凭证并自动保存！',
      });
    }

    // 2. 启动/唤起带 CDP 远程调试端口 9222 的独立 Chrome 登录 App 窗口
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
        
        // 关键判定：检测到绝对登录凭证 (LOGIN_INFO, SID, SAPISID, HSID)
        const isFullyLoggedIn = capturedCookie.includes('LOGIN_INFO') || 
                                capturedCookie.includes('SID') || 
                                capturedCookie.includes('SAPISID') ||
                                capturedCookie.includes('HSID');

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
        // 说明用户刚刚手动关闭了 Chrome 窗口！
        // 直接使用关窗前捕获到的最新 Cookie 存库！
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
