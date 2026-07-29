import { NextResponse } from 'next/server';
import { setSetting } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

/**
 * 尝试从本机的 Google Chrome Cookie 数据库或唤起 Chrome 获取真实的 YouTube Cookie
 */
async function extractLocalChromeCookies() {
  const platform = process.platform;
  let cookiePath = '';

  if (platform === 'darwin') {
    cookiePath = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default/Cookies');
  } else if (platform === 'win32') {
    cookiePath = path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data/Default/Network/Cookies');
  } else {
    cookiePath = path.join(os.homedir(), '.config/google-chrome/Default/Cookies');
  }

  // 如果本地有 Chrome Cookies 文件，尝试快速提取公开非加密 Cookie 项
  if (fs.existsSync(cookiePath)) {
    try {
      // 临时复制 Cookie 数据库文件避免 sqlite 锁定
      const tmpPath = path.join(os.tmpdir(), `yt_cookie_${Date.now()}.db`);
      fs.copyFileSync(cookiePath, tmpPath);

      // 使用 python3 快速提取其中的 visitor/login/session cookie 结构
      const pyScript = `
import sqlite3, json, sys

db_path = "${tmpPath}"
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name, value FROM cookies WHERE host_key LIKE '%youtube.com%'")
    rows = cursor.fetchall()
    cookies = []
    for name, value in rows:
        if value and len(value) > 0:
            cookies.append(f"{name}={value}")
    print("; ".join(cookies))
except Exception as e:
    print("")
`;
      const { stdout } = await execAsync(`python3 -c '${pyScript}'`);
      try { fs.unlinkSync(tmpPath); } catch (e) {}

      if (stdout && stdout.trim().length > 10) {
        return stdout.trim();
      }
    } catch (e) {
      console.warn('读取本地 Chrome 数据库失败:', e.message);
    }
  }

  return null;
}

/**
 * 唤起系统默认浏览器访问 YouTube 并提示用户确认
 */
async function launchChromeForLogin() {
  const platform = process.platform;
  const targetUrl = 'https://www.youtube.com';

  try {
    if (platform === 'darwin') {
      await execAsync(`open "${targetUrl}"`);
    } else if (platform === 'win32') {
      await execAsync(`start "" "${targetUrl}"`);
    } else {
      await execAsync(`xdg-open "${targetUrl}"`);
    }
  } catch (e) {
    console.warn('唤起系统浏览器失败:', e.message);
  }
}

export async function POST() {
  try {
    // 1. 尝试自动从本机的 Chrome 会话中捕获 YouTube 凭证
    let cookie = await extractLocalChromeCookies();

    // 2. 如果未能自动拉取到现有 Cookie，则唤起浏览器窗口供用户完成登录/认证
    if (!cookie || cookie.length === 0) {
      await launchChromeForLogin();
      
      // 等待 2 秒再次尝试提取
      await new Promise(r => setTimeout(r, 2000));
      cookie = await extractLocalChromeCookies();
    }

    if (cookie && cookie.length > 0) {
      // 3. 自动存入 SQLite 数据库
      setSetting('youtube_cookie', cookie);

      return NextResponse.json({
        success: true,
        cookie,
        message: '成功自动提取并保存 YouTube Cookie',
      });
    } else {
      // 弹出浏览器窗口让用户完成真人交互
      await launchChromeForLogin();

      return NextResponse.json({
        success: false,
        error: '已自动为您弹出了 YouTube 浏览器窗口，请在浏览器中完成页面加载或登录后，重新点击该按钮！',
      }, { status: 400 });
    }
  } catch (error) {
    console.error('获取 YouTube Cookie 失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
