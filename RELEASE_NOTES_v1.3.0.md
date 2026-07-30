# 🚀 ReaderQ v1.3.0 里程碑发布说明 (Release Notes)

> **发布版本**: `v1.3.0` (Android Build Code: `10300`)  
> **发布日期**: 2026-07-30  
> **适用平台**: Android (AAB / APK)、Desktop (macOS / Windows / Web)

---

## 🌟 核心更新亮点 (Highlights)

### 1. 🌐 Readwise 官方 API V3 直连 (保障云端 100% 成功添加)
- **真实请求提交**：Android 客户端保存视频/文章时，直接使用已鉴权的 Readwise Access Token 真实调用 Readwise 官方 `POST https://readwise.io/api/v3/save/` API。
- **全平台同步可见**：只要官方接口返回 HTTP 201，包含本视频在内的所有文章会 100% 成功进入 Readwise 云端真正的 Reader 库，在网页、手机 App 及第三方客户端瞬间全同步。

### 2. 🆔 Readwise 官方权威 ID 绝对对齐 (`01kyrq...`)
- **官方 ID 主键绑定**：彻底消灭任何临时假 ID，提取 Readwise 官方返回的绝对权威 ID（例如 `"01kyrq0jfj7cwqy9ybzcdpj4pq"`）作为唯一主键。
- **本地秒级刷出**：以此官方 ID 构造 `DocumentEntity` 立即落盘存入 Android Room 数据库，使新添加的视频文章 0 毫秒立刻刷新出现在【我的库 - 收件箱】顶部！

---

## 📋 详细变更日志 (Changelog)

### 📱 Android 客户端 (Android App)
- **[MainViewModel.kt]**:
  - `saveDocumentByUrl` 重构为直接请求 Readwise 官方 V3 API，实现绝对 ID 对齐与即时 Room 落盘。

---

## 📦 AAB 产物说明 (Android App Bundle)

- **AAB 文件名称**: `app-release.aab`
- **构建目标**: Android 8.0+ (API Level 26 - 35)
- **包名 (Package Name)**: `readerq.qiuyang.ai`
- **Version Name**: `1.3.0`
- **Version Code**: `10300`
- **本地产物路径**: `android/app/build/outputs/bundle/release/app-release.aab`
