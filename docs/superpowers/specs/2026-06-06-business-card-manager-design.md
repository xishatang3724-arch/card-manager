# 名片管理工具 — 设计文档

## 概述

一个轻量级名片管理工具，上传名片图片后自动通过 AI 识别名片信息并分析公司行业，支持搜索和标签管理。

## 架构

| 层级 | 技术栈 |
|------|--------|
| 前端 | React + Vite + Ant Design |
| 后端 | Fastify + better-sqlite3 |
| 数据库 | SQLite |
| AI | Kimi API (兼容 OpenAI 格式) |

**项目结构**：Monorepo，`client/` + `server/` 在同一个仓库下。

## 目录结构

```
606/
├── client/                     # React 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── CardList.jsx        # 名片列表 + 搜索
│   │   │   ├── CardDetail.jsx      # 名片详情
│   │   │   └── CardUpload.jsx      # 上传名片
│   │   ├── components/             # 通用组件
│   │   ├── services/
│   │   │   └── api.js              # Axios 封装
│   │   └── App.jsx
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── cards.js            # CRUD + 搜索
│   │   │   └── upload.js           # 图片上传
│   │   ├── services/
│   │   │   ├── ocr.js              # Kimi API OCR
│   │   │   └── company-analysis.js # Kimi 联网查公司
│   │   ├── db/
│   │   │   └── schema.js           # SQLite 表结构
│   │   └── index.js
│   └── package.json
│
└── uploads/                    # 名片图片存储
```

## 数据库模型

```sql
CREATE TABLE cards (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  company     TEXT,
  phone       TEXT,
  email       TEXT,
  industry    TEXT,                -- AI 分析的行业
  business    TEXT,                -- AI 分析的业务描述
  company_info TEXT,               -- 公司详细信息 (JSON 字符串)
  tags        TEXT DEFAULT '[]',   -- 标签 (JSON 数组)
  image_path  TEXT,                -- 图片相对路径
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cards_name ON cards(name);
CREATE INDEX idx_cards_company ON cards(company);
```

## 核心流程

### 上传识别流程

1. 用户上传名片图片
2. 后端保存图片到 `/uploads`
3. 后端调用 Kimi API 视觉模型，提取名片文字信息 → `{ name, company, phone, email }`
4. 若提取到公司名，再调用 Kimi API（联网搜索）查询公司行业和业务 → `{ industry, business, company_info }`
5. 全部数据写入 SQLite
6. 前端刷新列表展示新名片

### API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload` | 上传名片图片（multipart），返回识别结果 |
| GET | `/api/cards` | 获取名片列表（支持搜索/筛选/分页） |
| GET | `/api/cards/:id` | 获取单个名片详情 |
| PUT | `/api/cards/:id` | 更新名片信息（含标签） |
| DELETE | `/api/cards/:id` | 删除名片 |

### 搜索

- 全文搜索：通过 `LIKE` 匹配 name/company/phone/email
- 精确筛选：按 industry、company 字段精确匹配
- 标签筛选：从 tags JSON 数组中匹配
- 支持分页（page/limit）和排序（按创建时间）

## 用户界面

### 页面

1. **名片列表页** — 卡片式列表 + 搜索框 + 筛选器 + 标签过滤，每张卡片显示姓名、公司、电话
2. **名片详情页** — 展示完整名片信息 + AI 行业分析 + 公司业务描述，支持编辑和删除
3. **上传页** — 拖拽或选择名片图片，上传后自动识别，显示识别结果

### 技术选型

- 前端构建：Vite
- UI 组件库：Ant Design
- 图片上传：Ant Design Upload 组件
- 前后端通信：REST API via Axios

## AI 集成

使用 Kimi API（兼容 OpenAI SDK）：

- **API Key**: `sk-kimi-GY4lQXIcuypiJVhk7jMKfsNsVm1Ntp3ghbfdVYYgEznoUxfgrxkMR8aQdUrQquHA`
- **Base URL**: `https://api.moonshot.cn/v1`
- **OCR 识别模型**: kimi-k2.5（支持图片输入，视觉多模态模型）
- **公司分析模型**: kimi-k2.5（支持联网搜索功能）
