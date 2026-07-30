# 🚀 ReaderQ v1.2.8 发布说明 (Release Notes)

> **发布版本**: `v1.2.8` (Android Build Code: `10208`)  
> **发布日期**: 2026-07-30  
> **适用平台**: Android (AAB / APK)、Desktop (macOS / Windows / Web)

---

## 🌟 核心更新亮点 (Highlights)

### 1. 🧹 彻底移除“网关”等多余误导性术语文案
- **直观清晰的进度展示**：擦除了在 Android 客户端弹出的“网关响应延迟”等误导性内核词汇，全面替换为用户可读的真实进度展示：`正在从 YouTube 提取字幕中 (4s)...` -> `字幕已抓取，正在进行 AI 中英对照翻译 (10s)...` -> `✅ [完成] 字幕与 AI 双语对照已成功就绪！`

### 2. ⚡ 无缝异步触发与轮询同步防线
- **非阻塞管道触发**：Android 客户端发起视频处理任务后立即使用后台协程轮询复核，彻底杜绝因 SSE 长连接产生的卡顿、挂起或断开问题。

---

## 📋 详细变更日志 (Changelog)

### 📱 Android 客户端 (Android App)
- **[MainViewModel.kt]**:
  - 全面重构视频 Pipeline 处理与进度文案展示，全面提升移动端体验。

---

## 📦 AAB 产物说明 (Android App Bundle)

- **AAB 文件名称**: `app-release.aab`
- **构建目标**: Android 8.0+ (API Level 26 - 35)
- **包名 (Package Name)**: `readerq.qiuyang.ai`
- **Version Name**: `1.2.8`
- **Version Code**: `10208`
- **本地产物路径**: `android/app/build/outputs/bundle/release/app-release.aab`
