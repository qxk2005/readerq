# Antigravity IDE & Chrome CDP 浏览器连接深度诊断与排障指南 (CDP Troubleshooting & Architecture Deep-Dive)

本文档记录了 Antigravity IDE 中 `browser_subagent` 与 Chrome DevTools Protocol (CDP) 交互的底层机制、常见 HTTP 400 错误根因及完整的实测修复步骤。

---

## 🔬 底层原理与架构分析 (Architecture & CDP Mechanism)

### 1. Antigravity IDE 浏览器子代理工作机制
- Antigravity IDE 通过内置的 Playwright / CDP 客户端与运行在 `127.0.0.1:9222` 端口上的 Chrome 实例建立 WebSocket 长连接。
- 当在 Shell 中执行 Node 原生 WebSocket 握手测试 (`http.request` + `Upgrade: websocket`) 时，Chrome 9222 端口返回 `HTTP 101 Switching Protocols`（握手成功）。
- **为何 IDE 侧子代理依然提示 HTTP 400？**
  Antigravity IDE 的 `browser_subagent` 宿主 Daemon 进程是在 IDE 窗口初始化时随 Sidecar 进程一同启动的。该 Daemon 进程内部维护了 Playwright `BrowserContext` 连接句柄与端口缓存。当端口 9222 首次遭遇 Chrome 的 Origin/CORS 拒绝（HTTP 400）后，IDE 后端 Sidecar 会**缓存此异常状态**。
  因此，即使随后在终端成功重启了带有 `--remote-allow-origins=*` 的 Chrome 实例，IDE 侧的 Sidecar Daemon 仍在使用旧的句柄尝试复用连接，从而持续返回缓存的 HTTP 400 错误。

---

## 🚩 错误现象与诊断测试

### 现象
```text
failed to create browser context: failed to connect to browser via CDP: 
failed to connect to browser via CDP even though the CDP port is responsive: http://127.0.0.1:9222: 
playwright: Unexpected status 400 when connecting to http://127.0.0.1:9222/json/version/.
```

### 诊断步骤（在终端验证 CDP 端口真实状态）
可在终端运行以下 Node 诊断脚本，测试真实 CDP 接口响应：

```bash
node -e "
const http = require('http');
http.get('http://127.0.0.1:9222/json/version', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log('CDP Status:', res.statusCode, JSON.parse(data).Browser));
});
"
```

如果返回 `CDP Status: 200 Chrome/151.0...`，说明 Chrome 端已经完全正常，问题仅在于 **IDE 侧 Sidecar 连接缓存未释放**。

---

## 🛠️ 完整排查与 100% 恢复 SOP 流程

当遇到 CDP 400 错误时，请严格按照以下 3 步排查恢复：

### 第一步：彻底杀掉后台残余 Chrome 调试进程
```bash
pkill -9 -f "remote-debugging-port=9222" 2>/dev/null || true
```

### 第二步：带上安全参数重启 Chrome
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  '--remote-allow-origins=*' \
  --user-data-dir="$HOME/.gemini/antigravity-browser-profile" \
  --disable-fre \
  --no-default-browser-check \
  --no-first-run &>/dev/null &
```

### 第三步：重置 IDE 侧 Sidecar 进程与 CDP 缓存（最关键！）
由于 IDE 内部进程缓存了先前的连接失败状态，**必须重启/重载 IDE 窗口**以强行摧毁旧 Sidecar Daemon 并重建 CDP 连接：

1. 在 Antigravity IDE 界面按下快捷键：
   - **macOS**: `Cmd + Shift + P`
   - **Windows/Linux**: `Ctrl + Shift + P`
2. 在弹出指令栏中输入并回车：**`Developer: Reload Window`**
3. 窗口重新加载后，IDE 会重新初始化 Playwright Sidecar 客户端并成功建立 CDP WebSocket 连接。
4. *(极端情况下，若 Reload Window 后仍有问题，完全关闭并重启 Antigravity IDE 即可)*。

---

## 📝 记录与文档约定

- **项目规则 (`AGENTS.md`)**：已将该 SOP 规则固化在项目根目录 `AGENTS.md` 中，每次 Agent 会话均会自动读取生效。
- **排障指南 (`docs/CDP_TROUBLESHOOTING.md`)**：版本库永久文档，供未来调试参考。
