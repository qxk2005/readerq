#!/usr/bin/env node

/**
 * ReaderQ CLI - 服务管理工具（跨平台版，支持 macOS / Linux / Windows）
 * 用法: readerq --restart | --start | --stop | --status
 */

const { execSync, spawn } = require('child_process');
const { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, openSync } = require('fs');
const { join } = require('path');
const os = require('os');

const ROOT_DIR = join(__dirname, '..');
const PID_FILE = join(ROOT_DIR, 'data', '.readerq.pid');
const PORT = 3000;
const IS_WIN = os.platform() === 'win32';

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

// ---- 跨平台：精准查找占用指定端口 3000 的 LISTENING 进程 ----
function findProcessOnPort(port) {
  try {
    if (IS_WIN) {
      const output = execSync('netstat -ano', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      if (!output) return [];
      const pids = new Set();
      output.split('\n').forEach(line => {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const localAddr = parts[1] || '';
          const match = localAddr.match(/:(\d+)$/);
          if (match && parseInt(match[1], 10) === port) {
            const pid = parseInt(parts[parts.length - 1], 10);
            if (pid && !isNaN(pid)) pids.add(pid);
          }
        }
      });
      return [...pids];
    } else {
      const pids = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: 'utf-8' }).trim();
      if (!pids) return [];
      return pids.split('\n').map(p => parseInt(p, 10)).filter(p => !isNaN(p));
    }
  } catch {
    return [];
  }
}

// ---- 跨平台：杀掉进程 ----
function killProcess(pid) {
  try {
    if (IS_WIN) {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      try { process.kill(-pid, 'SIGKILL'); } catch { process.kill(pid, 'SIGKILL'); }
      try { execSync(`kill -9 ${pid} 2>/dev/null`, { stdio: 'ignore' }); } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

// ---- 停止服务 ----
function stopServer() {
  const pid = getSavedPid();

  if (pid && isRunning(pid)) {
    if (killProcess(pid)) {
      log(`  ✓ 已停止服务 (PID: ${pid})`, 'Y');
    }
  }

  const portPids = findProcessOnPort(PORT);
  if (portPids.length > 0) {
    portPids.forEach(p => killProcess(p));
    log(`  ✓ 已清理端口 ${PORT}`, 'Y');
  }

  try { if (existsSync(PID_FILE)) unlinkSync(PID_FILE); } catch {}
}

// ---- 启动服务 ----
function startServer() {
  log('  ⏳ 正在启动 ReaderQ 服务...', 'B');

  const dataDir = join(ROOT_DIR, 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const logFile = join(dataDir, 'server.log');

  // 1. 删除旧日志与 PID 文件
  try { if (existsSync(logFile)) unlinkSync(logFile); } catch {}
  try { if (existsSync(PID_FILE)) unlinkSync(PID_FILE); } catch {}

  // 2. 跨平台 Daemon 脱离后台启动 npm run dev
  const outFd = openSync(logFile, 'a');
  const errFd = openSync(logFile, 'a');

  const spawnCmd = IS_WIN ? 'cmd.exe' : 'npm';
  const spawnArgs = IS_WIN ? ['/c', 'npm', 'run', 'dev'] : ['run', 'dev'];

  const child = spawn(spawnCmd, spawnArgs, {
    cwd: ROOT_DIR,
    detached: true,
    stdio: ['ignore', outFd, errFd],
    env: process.env
  });
  child.unref();

  // 轮询端口与日志
  let attempts = 0;
  const maxAttempts = 40;
  const poll = setInterval(() => {
    attempts++;
    const pids = findProcessOnPort(PORT);
    if (pids.length > 0) {
      writeFileSync(PID_FILE, String(pids[0]));
    }

    try {
      if (existsSync(logFile)) {
        const content = readFileSync(logFile, 'utf-8');
        if ((content.includes('Ready') || content.includes('http://localhost')) && pids.length > 0) {
          clearInterval(poll);
          const activePid = pids[0];
          log(`  ✅ 服务已成功启动 (PID: ${activePid})`, 'G');
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
    } catch {}

    if (attempts >= maxAttempts) {
      clearInterval(poll);
      if (pids.length > 0) {
        log(`  ✅ 服务已在后台运行 (PID: ${pids[0]})`, 'G');
        log(`  ✅ 访问地址: http://localhost:${PORT}`, 'G');
      } else {
        log('  ⚠ 服务已发起启动命令，正在初始化...', 'Y');
        log(`  ℹ 请稍后访问: http://localhost:${PORT}`, 'Y');
      }
      log('');
      process.exit(0);
    }
  }, 500);
}

// ---- 查看状态 ----
function showStatus() {
  const pid = getSavedPid();
  const portPids = findProcessOnPort(PORT);

  if (portPids.length > 0) {
    log(`  ✅ 服务正在运行 (PID: ${portPids.join(', ')})`, 'G');
    log(`  ✅ 访问地址: http://localhost:${PORT}`, 'G');
  } else if (pid && isRunning(pid)) {
    log(`  ✅ 服务正在运行 (PID: ${pid})`, 'G');
    log(`  ✅ 访问地址: http://localhost:${PORT}`, 'G');
  } else {
    log('  ℹ 服务未运行', 'Y');
  }
}

// ---- 主入口 ----
function main() {
  banner();
  const arg = process.argv[2];

  switch (arg) {
    case '--restart':
      stopServer();
      startServer();
      break;
    case '--start':
      if (findProcessOnPort(PORT).length > 0) {
        log('  ℹ 服务已在运行中', 'Y');
      } else {
        startServer();
      }
      break;
    case '--stop':
      stopServer();
      break;
    case '--status':
      showStatus();
      break;
    default:
      log('  用法: readerq --restart | --start | --stop | --status', 'Y');
      break;
  }
}

main();
