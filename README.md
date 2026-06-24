<p align="center">
  <img src="public/logo.png" width="120" height="120" style="border-radius: 24px;" alt="ReaderQ Logo">
</p>

<h1 align="center">ReaderQ</h1>

<p align="center">
  <strong>Readwise Reader 开源复刻版 — 智能阅读助手</strong>
</p>

集中管理、标注和消化你的数字阅读内容。使用 Readwise API 连接你的阅读数据，通过 OpenAI 兼容服务器驱动 AI 功能。致力于提供如丝般顺滑、闪电般快速的极致阅读体验。

## 📸 界面纵览

![ReaderQ 三栏式桌面阅读体验](public/readerq_ui.png)

---

## 🏗️ 程序架构

ReaderQ 采用了前后端分离但高度内聚的架构体系，最大限度保证性能与体验：

![ReaderQ 系统架构图](public/readerq_arch.png)
- **前端架构 (Frontend)**: 基于 React (Next.js App Router)，通过统一的全局状态管理器 (`AppContext`) 分发数据，确保所有组件状态（如文档列表、阅读正文、高亮数据）保持同步。
- **后端架构 (Backend)**: Next.js API Routes 充当中转网关，与两大核心数据源交互：本地的高速 SQLite 缓存库 (`better-sqlite3`) 和远端 Readwise V3 API。
- **数据流转策略**:
  1. **首次加载**：从本地 SQLite 数据库秒开文档，同时在后台异步向 Readwise 拉取更新，实现“零等待”体验。
  2. **元数据更新**：对文档备注、标签或高亮的修改，会同时进行三步走战略：(1) 调用 Readwise API 保存至云端；(2) 写入本地 SQLite 落盘保存；(3) 触发前台乐观更新（Optimistic Updates），立刻反馈在 UI 上，彻底解决因 API 最终一致性带来的数据“幽灵消失”问题。

## 🎨 界面布局与设计

ReaderQ 采用经典的“三栏式”桌面级效率工具布局（可使用 `[` 和 `]` 快捷键自由折叠伸缩）：
1. **左侧导航栏 (Sidebar)**：提供全局导航，支持按视图（收件箱、归档等）、类型（PDF、文章、推文等）或标签对文档进行多维度过滤。
2. **中间列表区 (Document List)**：呈现阅读流，实时展现文档的标题、出处、预计阅读时间及阅读进度等元信息。
3. **右侧工作区 (Workspace)**：
   - **阅读面板 (Reading Pane)**：提供极净的无干扰阅读体验。长按选中文本即刻弹出高亮/批注悬浮窗，所见即所得。
   - **多标签页侧控台 (Right Panel)**：
     - **Info**：展示当前文档的基础信息。
     - **Notebook**：文档级笔记（Document Note）与多标签（Tags）的可视化智能编辑区，支持输入联想推荐；集中展示文章内所有的高亮及单条批注，支持与 Readwise 后台的单条校验。
     - **Chat (GhostReader)**：基于当前文档上下文的 AI 智能助手对话框，随时为你解惑、翻译或总结。

## 💡 设计思想与限制约束

### 设计思想
- **快即是正义**：本地 SQLite 的存在不是为了离线，而是为了**快**。通过缓存消除一切网络延迟的等待感。
- **所见即所得的极简美学**：UI 必须经得起长时间凝视。从平滑过渡动画到精准的字距/行高调节，每一处视觉都需克制且优雅。
- **交互的确定性**：所有的用户修改（包括增删高亮、编辑标签），必须在页面中提供确定的视觉反馈，并在底层通过“乐观更新”保证视觉连贯。

### 限制约束
- **API 最终一致性限制**：由于 Readwise V3 API 的读写存在微小延迟的“最终一致性”现象，前端不能在写入后立刻通过全局网络重新拉取，否则会遭遇数据倒退覆盖的 Race Condition。因此采用了局部更新内存状态的方案。
- **DOM 选择器限制**：由于浏览器的 Selection API 对复杂嵌套结构的限制，高亮模块采用了复杂的绝对偏移量计算 (`getTextOffset`) 进行恢复，确保刷新页面后高亮色块能毫厘不差地附着在原始文本上。

## ✨ 功能特性

### 📚 阅读与标注管理
- **丰富的过滤系统**：多维交叉筛选你的所有已存数字内容。
- **智能批注体验**：类原生应用的高亮选取体验，支持五种高亮色彩，以及针对单条高亮的备注与智能标签建议。
- **状态无缝同步**：所有的操作自动在云端完成同步对齐。

### 🤖 AI 助手 (GhostReader)
- **文档自动摘要与多语言翻译**
- **上下文深度理解**：随时划词询问，或者向当前阅读的文献发起全局提问。

## 🚀 部署与启停命令

你可以使用配套的 CLI 工具或 npm 命令来启停项目。

### 初始化项目
```bash
git clone https://github.com/qxk2005/readerq.git
cd readerq
npm install
cp .env.example .env.local
```

### 环境配置 (`.env.local`)
```env
# 必须：Readwise V3 API Token (从 https://readwise.io/access_token 获取)
READWISE_API_TOKEN=your_token_here

# 可选：用于启用 GhostReader 的 OpenAI 兼容 API 配置
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

### 启停命令 (CLI 工具)
系统内置了便捷的快捷脚本用于服务生命周期管理：
```bash
# 启动或重启后台服务，自动清理被占用的 3000 端口
readerq --restart

# 服务成功启动后，将在后台持续运行，你可以访问:
# http://localhost:3000

# 所有的后端日志与报错信息会实时输出至：
tail -f data/server.log
```
*(你也可以使用传统的 `npm run dev` 在前台启动开发服务器)*

## ⌨️ 快捷键速查

| 快捷键 | 功能 |
|--------|------|
| `⌘/Ctrl + K` | 呼出全局命令面板 |
| `⌘/Ctrl + N` | 快速添加新文章 |
| `⌘/Ctrl + Shift + A` | 唤起 AI 助手 |
| `⌘/Ctrl + Shift + S` | 强制同步云端数据 |
| `⌘/Ctrl + Shift + L` | 切换明暗主题 |
| `[` | 收起/展开左侧导航栏 |
| `]` | 打开/关闭右侧面板 |
| `Esc` | 关闭当前弹窗或取消选择 |

## 🛡️ 安全与技术栈

- **安全性**：密钥仅存在本地 `.env.local` 且不暴露给浏览器前端；本地 SQLite `.db` 文件静默存储在 `data/` 目录下不会上传远端仓库。
- **核心技术栈**: Next.js 15 (App Router), better-sqlite3, Vanilla CSS 变量驱动。

## 📄 许可证

MIT License
