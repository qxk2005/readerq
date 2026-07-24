<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Antigravity IDE CDP 浏览器连接排障规则

如果在此项目中使用 `browser_subagent` 或其他浏览器工具遇到 CDP (Chrome DevTools Protocol) 连接 400 错误（例如 `failed to connect to browser via CDP`），请按照以下规则排查：

1. **检查 `--remote-allow-origins` 参数**：
   - 默认由 IDE 自动运行的 Chrome 实例可能未携带 `--remote-allow-origins=*`。
   - 这会导致新版本的 Chrome (如 Chrome 149+) 拒绝 WebSocket 连接，从而导致 Playwright/CDP 客户端连接时返回 HTTP 400。
   - 解决办法是手动杀死旧的 Chrome 并带上该参数重启：
     ```bash
     # 1. 杀死旧实例
     pkill -f "Google Chrome --remote-debugging-port=9222"
     # 2. 带参数重启
     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 '--remote-allow-origins=*' --user-data-dir="$HOME/.gemini/antigravity-browser-profile" --disable-fre --no-default-browser-check --no-first-run &>/dev/null &
     ```

2. **清空残留的旧状态与重启**：
   - 即使端口 9222 重新可用，Antigravity IDE 内部可能仍缓存了先前的连接失败状态。
   - 建议引导用户或直接尝试重新加载窗口：在 IDE 中按 `Cmd+Shift+P` 运行 `Developer: Reload Window`。
   - 若依然失败，建议用户完全重启 Antigravity IDE。

# 📦 ReaderQ 编译打包与版本一致性工作流规则

当用户要求打包 GitHub Actions 或本地编译 Android AAB 时，必须**严密遵循以下标准 SOP 流程**：

1. **版本优先提升 (Version-First Policy)**：
   - 在触发任何编译动作之前，**首先更新 `package.json` 中的 `version` 字段**（如从 `1.0.76` 提升至 `1.0.77`）；
   - 确保 `package.json` 中的版本修改已 `git commit` 并包含于即将编译的代码库中，这样 Next.js `next.config.mjs` 构建时才能将正确的 `NEXT_PUBLIC_APP_VERSION` 注入到前端 Bundle 中。

2. **双端双向同步编译 (Synchronous Dual Build)**：
   - 无论用户要求“打包 GitHub Actions”还是“本地编译 AAB”，**必须同时执行这两者**，不能漏掉任何一方：
     - **步骤 A（本地 AAB 编译）**：首先在本地执行 `npm run build && cd android && ./gradlew bundleRelease`，生成最新的本地 `app-release.aab`；
     - **步骤 B（GitHub Actions 云端发布）**：打上与 `package.json` 版本一致的 Git Tag (如 `git tag v1.0.77`) 并推送到远程 `git push origin main && git push origin v1.0.77`，触发 GitHub Actions 云端构建多平台 Desktop 桌面客户端与 Android APK/AAB。

3. **双端版本一致性核验 (Version Consistency Check)**：
   - 在部署打包完成后，**必须显式核对并向用户确认**：
     - 本地 `package.json` 版本；
     - GitHub Tag 版本；
     - 本地生成的 `app-release.aab` 内注入的版本号。
   - 确保桌面端 (Desktop) 与移动端 (Android) 客户端的版本号 100% 保持严格一致！
