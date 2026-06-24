#!/usr/bin/env node

/**
 * ReaderQ CLI - 服务管理工具
 * 用法: readerq --restart | --start | --stop | --status
 */

const { execSync, spawn } = require('child_process');
const { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } = require('fs');
const { join } = require('path');

const ROOT_DIR = join(__dirname, '..');
const PID_FILE = join(ROOT_DIR, 'data', '.readerq.pid');
const PORT = 3000;

// ---- 颜色 ----
const C = {
  R: '\x1b[0m', G: '\x1b[32m', E: '\x1b[31m',
  Y: '\x1b[33m', B: '\x1b[36m', D: '\x1b[1m',
};
const log = (m, c = 'R') => console.log(`${C[c]}${m}${C.R}`);

function banner() {
  log('');
  log('  📖 ReaderQ - 智能阅读助手', 'B');
  log('  ─────────────────────────', 'B');
  log('');
}

// ---- PID 管理 ----
function getSavedPid() {
  if (!existsSync(PID_FILE)) return null;
  const pid = readFileSync(PID_FILE, 'utf-8').trim();
  return pid ? parseInt(pid, 10) : null;
}

function isRunning(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// ---- 停止 ----
function stopServer() {
  const pid = getSavedPid();

  if (pid && isRunning(pid)) {
    try {
      // 杀掉进程组（detached 模式启动的子进程组）
      process.kill(-pid, 'SIGTERM');
      log(`  ✓ 已停止服务 (PID: ${pid})`, 'Y');
    } catch {
      try { process.kill(pid, 'SIGTERM'); } catch { /* ignore */ }
    }
  }

  // 兜底：杀掉所有占用端口的进程
  try {
    const pids = execSync(`lsof -ti:${PORT} 2>/dev/null`, { encoding: 'utf-8' }).trim();
    if (pids) {
      pids.split('\n').forEach(p => {
        try { process.kill(parseInt(p, 10), 'SIGTERM'); } catch { /* ignore */ }
      });
      log(`  ✓ 已清理端口 ${PORT}`, 'Y');
    }
  } catch { /* 端口空闲 */ }

  // 清理 PID 文件
  try { if (existsSync(PID_FILE)) unlinkSync(PID_FILE); } catch { /* ignore */ }
}

// ---- 启动 ----
function startServer() {
  log('  ⏳ 正在启动 ReaderQ 服务...', 'B');

  const dataDir = join(ROOT_DIR, 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const logFile = join(dataDir, 'server.log');

  // 使用 shell 的 nohup 启动，避免 detached+pipe IO 阻塞问题
  const child = spawn('sh', ['-c', `nohup npm run dev > "${logFile}" 2>&1 &\necho $!`], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let pidStr = '';
  child.stdout.on('data', (buf) => { pidStr += buf.toString(); });

  child.on('close', () => {
    const pid = parseInt(pidStr.trim(), 10);
    if (!pid || isNaN(pid)) {
      log('  ✗ 启动失败：无法获取 PID', 'E');
      process.exit(1);
    }

    writeFileSync(PID_FILE, String(pid));

    // 轮询日志文件等待 "Ready"
    let attempts = 0;
    const maxAttempts = 30;
    const poll = setInterval(() => {
      attempts++;
      try {
        if (existsSync(logFile)) {
          const content = readFileSync(logFile, 'utf-8');
          if (content.includes('Ready')) {
            clearInterval(poll);
            log(`  ✅ 服务已启动 (PID: ${pid})`, 'G');
            log(`  ✅ 访问地址: http://localhost:${PORT}`, 'G');
            log(`  ✅ 日志文件: data/server.log`, 'G');
            log('');
            process.exit(0);
          }
          if (content.includes('EADDRINUSE')) {
            clearInterval(poll);
            log(`  ✗ 端口 ${PORT} 被占用，启动失败`, 'E');
            process.exit(1);
          }
        }
      } catch { /* ignore */ }

      if (attempts >= maxAttempts) {
        clearInterval(poll);
        log(`  ✅ 服务正在后台启动 (PID: ${pid})`, 'G');
        log(`  ✅ 请稍候访问: http://localhost:${PORT}`, 'G');
        log(`  ✅ 日志文件: data/server.log`, 'G');
        log('');
        process.exit(0);
      }
    }, 500);
  });

  child.on('error', (err) => {
    log(`  ✗ 启动失败: ${err.message}`, 'E');
    process.exit(1);
  });
}

// ---- 状态 ----
function showStatus() {
  const pid = getSavedPid();
  if (pid && isRunning(pid)) {
    log(`  ✅ 服务正在运行 (PID: ${pid})`, 'G');
    log(`  ✅ 地址: http://localhost:${PORT}`, 'G');
  } else {
    try {
      const p = execSync(`lsof -ti:${PORT} 2>/dev/null`, { encoding: 'utf-8' }).trim();
      if (p) {
        log(`  ⚠ 端口 ${PORT} 被占用 (PID: ${p})`, 'Y');
      } else {
        log('  ℹ 服务未运行', 'Y');
      }
    } catch {
      log('  ℹ 服务未运行', 'Y');
    }
  }
  log('');
}

// ---- 主逻辑 ----
const cmd = process.argv[2] || '--help';
banner();

switch (cmd) {
  case '--restart':
  case '-r':
    log('  🔄 重启服务...', 'D');
    stopServer();
    setTimeout(() => startServer(), 2000);
    break;

  case '--start':
  case '-s':
    startServer();
    break;

  case '--stop':
  case '-x':
    stopServer();
    log('');
    break;

  case '--status':
  case '-t':
    showStatus();
    break;

  case '--help':
  case '-h':
  default:
    log('  用法: readerq <命令>', 'D');
    log('');
    log('    --restart, -r    重启前后台服务');
    log('    --start,  -s    启动服务');
    log('    --stop,   -x    停止服务');
    log('    --status, -t    查看服务状态');
    log('    --help,   -h    显示帮助');
    log('');
    break;
}
