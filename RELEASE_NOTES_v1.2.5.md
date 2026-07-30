# 🚀 ReaderQ v1.2.5 发布说明 (Release Notes)

> **发布版本**: `v1.2.5` (Android Build Code: `10205`)  
> **发布日期**: 2026-07-29  
> **适用平台**: Android (AAB / APK)、Desktop (macOS / Windows / Web)

---

## 🌟 核心更新亮点 (Highlights)

### 1. 📱 彻底修复 Android 端连接 `127.0.0.1:3000` 失败的硬伤
- **擦除硬编码死锁**：彻底清除了 Android 客户端中强行将未配置 Base URL 或模拟器 `10.0.2.2` 恶意替换为 `127.0.0.1:3000` 的荒谬代码。
- **保留真实连接**：完整保留 Android 客户端用户填写的自定义服务器地址或模拟器/云端真实 URL。

### 2. 💡 友好易懂的服务器引导提示
- **清晰排错引导**：当手机在未配置服务器或网络不通连不上 Server 时，抛出的错误提升为人性化的引导：`⚠️ 未连接到 Node 服务端: 请在【设置-服务器设置】中填写您的 ReaderQ 服务端 URL`。
- **绝不阻塞核心保存**：当云端字幕提取跳过时，视频文章本身依然秒级安全保存到 ReaderQ 本地数据库中。

---

## 📋 详细变更日志 (Changelog)

### 📱 Android 客户端 (Android App)
- **[ReadwiseClient.kt]**:
  - 彻底清理 `fetchBlogFromServerFull`, `fetchSubtitleFromServerFull`, `triggerServerSubtitleDownload` 中将 URL 硬编码替换为 `127.0.0.1:3000` 的漏洞。
- **[MainViewModel.kt]**:
  - 重构 `getServerBaseUrl()` 逻辑，优先读取 `server_base_url` 设置。
  - 优化视频 Pipeline 处理异常捕获，在无法连接时提供精准的引导提示。

---

## 📦 AAB 产物说明 (Android App Bundle)

- **AAB 文件名称**: `app-release.aab`
- **构建目标**: Android 8.0+ (API Level 26 - 35)
- **包名 (Package Name)**: `readerq.qiuyang.ai`
- **Version Name**: `1.2.5`
- **Version Code**: `10205`
- **本地产物路径**: `android/app/build/outputs/bundle/release/app-release.aab`
