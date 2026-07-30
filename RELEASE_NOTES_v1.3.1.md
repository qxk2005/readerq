# 🚀 ReaderQ v1.3.1 发布说明 (Release Notes)

> **发布版本**: `v1.3.1` (Android Build Code: `10301`)  
> **发布日期**: 2026-07-30  
> **适用平台**: Android (AAB / APK)、Desktop (macOS / Windows / Web)

---

## 🌟 核心更新亮点 (Highlights)

### 1. ⚡ Android 原生免 Cookie 字幕抓取引擎 (`AndroidSubtitleFetcher`)
- **完全离线自治**：当 Android 手机无法连接外部 Node 3000 后端或后端超时 / 返回 502 时，Android 客户端自动启动原生字幕引擎。
- **句子级优雅封包**：按完整句尾标点（`.` `!` `?`）及 3.5s ~ 8.0s 优雅时间窗封包合并，彻底消除 1.5 秒碎卡片腰斩。

### 2. 🤖 Android 原生 OpenAI 双语翻译与 Markdown 视频博客生成
- **原生双语翻译**：Android 端直接调用已配置的大模型 Endpoint，实时对提取到的英文字幕轨进行流畅的中文中英对照翻译。
- **原生 Markdown 博客**：自动调用大模型生成带视频时间戳 `[mm:ss]` 的 Markdown 精选视频博客文章，落地存入 Android 本地数据库！

---

## 📋 详细变更日志 (Changelog)

### 📱 Android 客户端 (Android App)
- **[AndroidSubtitleFetcher.kt]**:
  - 新增 Kotlin 原生免 Cookie 字幕解析器、句子封包器、OpenAI 双语翻译与 Markdown 博客生成器。
- **[MainViewModel.kt]**:
  - 重构 `downloadSubtitleFromServer` 与 `saveDocumentByUrl`，全面无缝接入 Android 原生降级保障流。

---

## 📦 AAB 产物说明 (Android App Bundle)

- **AAB 文件名称**: `app-release.aab`
- **构建目标**: Android 8.0+ (API Level 26 - 35)
- **包名 (Package Name)**: `readerq.qiuyang.ai`
- **Version Name**: `1.3.1`
- **Version Code**: `10301`
- **本地产物路径**: `android/app/build/outputs/bundle/release/app-release.aab`
