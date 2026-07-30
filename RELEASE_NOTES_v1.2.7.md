# 🚀 ReaderQ v1.2.7 发布说明 (Release Notes)

> **发布版本**: `v1.2.7` (Android Build Code: `10207`)  
> **发布日期**: 2026-07-30  
> **适用平台**: Android (AAB / APK)、Desktop (macOS / Windows / Web)

---

## 🌟 核心更新亮点 (Highlights)

### 1. 🛡️ 禁用 Nginx 缓冲区 (彻底根治 502 长连接超时)
- **后端注入 `X-Accel-Buffering: no`**：在 `POST /api/video-pipeline/process` SSE 响应头中注入 Nginx 专有不缓冲标头，强制反向代理网关跳过 Socket 缓冲，防止 Nginx 在处理耗时音视频抓取时误判 502。

### 2. ⚡ Android 客户端 502 轮询防线 (Resilience Protection)
- **云端后台状态轮询**：即便遇到代理网关断开抛出 502/503，Android 客户端会自动启动后台轮询机制，主动查询已生成就绪的字幕。只要云端后台写入完成，UI 即可无缝展示 `✅ [完成] 字幕已在云端后台处理完成`。

---

## 📋 详细变更日志 (Changelog)

### 🎥 视频 Pipeline 处理
- **[route.js]**:
  - `POST /api/video-pipeline/process` 响应头加入 `'X-Accel-Buffering': 'no'`。
- **[MainViewModel.kt]**:
  - 增加 502 / 503 网关异常降级轮询防线。

---

## 📦 AAB 产物说明 (Android App Bundle)

- **AAB 文件名称**: `app-release.aab`
- **构建目标**: Android 8.0+ (API Level 26 - 35)
- **包名 (Package Name)**: `readerq.qiuyang.ai`
- **Version Name**: `1.2.7`
- **Version Code**: `10207`
- **本地产物路径**: `android/app/build/outputs/bundle/release/app-release.aab`
