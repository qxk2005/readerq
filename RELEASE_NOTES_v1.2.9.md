# 🚀 ReaderQ v1.2.9 发布说明 (Release Notes)

> **发布版本**: `v1.2.9` (Android Build Code: `10209`)  
> **发布日期**: 2026-07-30  
> **适用平台**: Android (AAB / APK)、Desktop (macOS / Windows / Web)

---

## 🌟 核心更新亮点 (Highlights)

### 1. ⚡ 保存即刻写入 Room 本地数据库 (0 毫秒 UI 立刻刷新)
- **保存即显示**：当在 Android 端保存添加任何视频或文章 URL 时，系统在获得 ID 的第一秒立刻构造 `DocumentEntity` 写入 Android 本地 Room 数据库，使新保存的视频文章 0 毫秒延时立刻显示在【我的库 - 收件箱】列表最上方，不再依赖长连接或服务器未完成的索引同步。

---

## 📋 详细变更日志 (Changelog)

### 📱 Android 客户端 (Android App)
- **[MainViewModel.kt]**:
  - `saveDocumentByUrl` 保存成功后新增 `docDao.insertDocument(newDocEntity)` 本地落地写入。

---

## 📦 AAB 产物说明 (Android App Bundle)

- **AAB 文件名称**: `app-release.aab`
- **构建目标**: Android 8.0+ (API Level 26 - 35)
- **包名 (Package Name)**: `readerq.qiuyang.ai`
- **Version Name**: `1.2.9`
- **Version Code**: `10209`
- **本地产物路径**: `android/app/build/outputs/bundle/release/app-release.aab`
