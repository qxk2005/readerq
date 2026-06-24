# ReaderQ 📖

> Readwise Reader 开源复刻版 — 智能阅读助手

集中管理、标注和消化你的数字阅读内容。使用 Readwise API 连接你的阅读数据，通过 OpenAI 兼容服务器驱动 AI 功能。

## ✨ 功能特性

### 📚 阅读管理
- 三栏布局：导航栏 / 文档列表 / 阅读面板
- 按位置筛选：收件箱、稍后阅读、短列表、归档、订阅源
- 按类别筛选：文章、PDF、电子书、邮件、RSS、推文、视频
- 标签管理和筛选
- 文档搜索
- 阅读进度追踪

### 🤖 AI 助手 (GhostReader)
- 文档自动摘要
- 文本翻译（多语言）
- 复杂文本简化
- 词义/概念查询
- 基于文档的 AI 对话

### 🎨 阅读体验
- 深色 / 浅色模式
- 字体、字号、行高、内容宽度自定义
- 键盘快捷键系统
- 命令面板 (Cmd/Ctrl + K)
- 流畅的过渡动画

### 🔗 数据集成
- Readwise v3 API 全量对接
- 本地 SQLite 缓存加速
- 增量同步 + 全量同步
- 保存新文章到 Reader

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/qxk2005/readerq.git
cd readerq
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的配置：

```env
# Readwise API Token (从 https://readwise.io/access_token 获取)
READWISE_API_TOKEN=your_token_here

# OpenAI 兼容 API 配置
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `⌘/Ctrl + K` | 命令面板 |
| `⌘/Ctrl + N` | 添加文章 |
| `⌘/Ctrl + Shift + A` | AI 助手 |
| `⌘/Ctrl + Shift + S` | 同步数据 |
| `⌘/Ctrl + Shift + L` | 切换主题 |
| `[` | 收起/展开侧栏 |
| `]` | 打开/关闭 AI 面板 |
| `Esc` | 关闭弹窗 |

## 🛡️ 安全说明

- 所有 API 密钥存储在 `.env.local` 中，不会提交到 Git
- API 请求通过 Next.js 服务端路由代理，密钥不暴露到前端
- SQLite 数据库文件存储在 `data/` 目录，同样被 Git 忽略

## 🏗️ 技术栈

- **框架**: Next.js 15 (App Router)
- **数据库**: SQLite (better-sqlite3)
- **AI**: OpenAI 兼容 API
- **样式**: Vanilla CSS + CSS Variables
- **数据**: Readwise v3 API

## 📄 许可证

MIT License
