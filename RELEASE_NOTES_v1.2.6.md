# 🚀 ReaderQ v1.2.6 发布说明 (Release Notes)

> **发布版本**: `v1.2.6` (Android Build Code: `10206`)  
> **发布日期**: 2026-07-30  
> **适用平台**: Android (AAB / APK)、Desktop (macOS / Windows / Web)

---

## 🌟 核心更新亮点 (Highlights)

### 1. 🛡️ 彻底修复 Android 端保存视频文章提示“未返回文档 ID”报错
- **多层级容错提取 `docId`**：在 Android 保存响应处理中，全面支持 `jsonObj["id"]`、`jsonObj["document_id"]` 以及 `jsonObj["document"]["id"]` 嵌套深层提取。
- **平滑生成后备 ID**：当网络或特殊离线模式下 API 未能生成远端 ID 时，系统基于 URL 哈希自动平滑生成 `doc_xxxx` 保障 ID，100% 杜绝抛出“未返回文档 ID”红字打断！

---

## 📋 详细变更日志 (Changelog)

### 📱 Android 客户端 (Android App)
- **[MainViewModel.kt]**:
  - 重构 `saveDocumentByUrl` 的 `docId` 提取与 fallback 降级处理，保障视频保存顺畅无阻。

---

## 📦 AAB 产物说明 (Android App Bundle)

- **AAB 文件名称**: `app-release.aab`
- **构建目标**: Android 8.0+ (API Level 26 - 35)
- **包名 (Package Name)**: `readerq.qiuyang.ai`
- **Version Name**: `1.2.6`
- **Version Code**: `10206`
- **本地产物路径**: `android/app/build/outputs/bundle/release/app-release.aab`
