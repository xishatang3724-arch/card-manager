# 名片管理工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a business card manager with React frontend, Fastify backend, SQLite database, and Kimi AI for OCR + company analysis.

**Architecture:** Monorepo with `/client` (Vite + React + Ant Design) and `/server` (Fastify + better-sqlite3). Upload flow: image → Kimi OCR → extract card info → Kimi web search for company → save to DB → display.

**Tech Stack:** React 18, Vite 6, Ant Design 5, Fastify 5, better-sqlite3, OpenAI SDK (Kimi-compatible API)

**Note on all services/services files:** The server uses **ESM** (`"type": "module"` in package.json), so all imports use `import`/`export` syntax.

---

### Task 1: Server scaffolding + DB schema

**Files:**
- Create: `server/package.json`
- Create: `server/.env`
- Create: `server/.env.example`
- Create: `server/src/index.js`
- Create: `server/src/db/schema.js`

- [ ] **Step 1: Create server/package.json**

```json
{
  "name": "business-card-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js"
  },
  "dependencies": {
    "fastify": "^5.2.0",
    "@fastify/multipart": "^9.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/static": "^8.0.0",
    "better-sqlite3": "^11.7.0",
    "openai": "^4.80.0",
    "dotenv": "^16.4.0"
  }
}
```

- [ ] **Step 2: Create server/.env and server/.env.example**

`.env`:
```
KIMI_API_KEY=sk-kimi-GY4lQXIcuypiJVhk7jMKfsNsVm1Ntp3ghbfdVYYgEznoUxfgrxkMR8aQdUrQquHA
PORT=3001
```

`.env.example`:
```
KIMI_API_KEY=your-kimi-api-key
PORT=3001
```

- [ ] **Step 3: Create server/src/db/schema.js**

```javascript
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db;

export function getDb() {
  if (db) return db;

  const dbDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dbDir, { recursive: true });

  db = new Database(path.join(dbDir, 'cards.db'));
  db.pragma('journal_mode = WAL');
  initSchema();
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      company     TEXT,
      phone       TEXT,
      email       TEXT,
      industry    TEXT,
      business    TEXT,
      company_info TEXT,
      tags        TEXT DEFAULT '[]',
      image_path  TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
    CREATE INDEX IF NOT EXISTS idx_cards_company ON cards(company);
  `);
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
```

- [ ] **Step 4: Create server/src/index.js**

```javascript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './db/schema.js';
import uploadRoutes from './routes/upload.js';
import cardRoutes from './routes/cards.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({ logger: true });

// Register plugins
await fastify.register(cors, { origin: true });
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

// Serve uploaded images
const uploadsDir = path.resolve(process.cwd(), '..', 'uploads');
await fastify.register(staticFiles, {
  root: uploadsDir,
  prefix: '/uploads/',
  decorateReply: false,
});

// Initialize DB
getDb();

// Register routes
await fastify.register(uploadRoutes);
await fastify.register(cardRoutes);

// Health check
fastify.get('/api/health', async () => ({ status: 'ok' }));

// Graceful shutdown
const shutdown = async () => {
  closeDb();
  await fastify.close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start
const port = parseInt(process.env.PORT || '3001');
try {
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`Server running on http://localhost:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
```

- [ ] **Step 5: Create uploads/ directory and install dependencies**

```bash
mkdir -p /Users/xishatang/Desktop/606/uploads
cd /Users/xishatang/Desktop/606/server && npm install
```

Expected: no errors, node_modules created.

- [ ] **Step 6: Test server starts**

```bash
cd /Users/xishatang/Desktop/606/server && node src/index.js
```

Expected: `Server running on http://localhost:3001` and no crash. Verify `data/cards.db` is created.
Stop with Ctrl+C after confirmation.

---

### Task 2: Kimi OCR service

**Files:**
- Create: `server/src/services/ocr.js`

- [ ] **Step 1: Create server/src/services/ocr.js**

```javascript
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
});

/**
 * Extract business card info from an image file using Kimi Vision API.
 * @param {string} imagePath - Absolute path to the image file
 * @returns {Promise<{name: string|null, company: string|null, phone: string|null, email: string|null}>}
 */
export async function extractBusinessCard(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const response = await openai.chat.completions.create({
    model: 'kimi-k2.5',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '你是一个名片识别助手。请从这张名片图片中提取信息，严格按照以下JSON格式返回（不要markdown标记，不要其他文字）：\n{"name": "姓名", "company": "公司名称", "phone": "电话号码", "email": "邮箱地址"}\n如果找不到某个字段，设为null。',
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 512,
  });

  const text = response.choices[0]?.message?.content || '';
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    const result = JSON.parse(cleaned);
    return {
      name: result.name || null,
      company: result.company || null,
      phone: result.phone || null,
      email: result.email || null,
    };
  } catch (err) {
    throw new Error(`Failed to parse OCR result: ${cleaned}`);
  }
}
```

- [ ] **Step 2: Quick smoke test**

```bash
cd /Users/xishatang/Desktop/606/server && node -e "
import('dotenv/config.js').then(() => {
  import('./src/services/ocr.js').then(async m => {
    try {
      const r = await m.extractBusinessCard('/path/to/test-card.jpg');
      console.log('OCR result:', JSON.stringify(r, null, 2));
    } catch(e) { console.error(e.message); }
  });
});
"
```

If you don't have a test card image yet, skip this step — the service will be verified end-to-end in Task 4.

---

### Task 3: Kimi company analysis service

**Files:**
- Create: `server/src/services/company-analysis.js`

- [ ] **Step 1: Create server/src/services/company-analysis.js**

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
});

/**
 * Search the web for company info and return industry/business.
 * @param {string} companyName - Company name to search
 * @returns {Promise<{industry: string|null, business: string|null, company_info: string|null}>}
 */
export async function analyzeCompany(companyName) {
  const response = await openai.chat.completions.create({
    model: 'kimi-k2.5',
    messages: [
      {
        role: 'system',
        content: '你是一个公司信息分析师。请使用联网搜索功能查找真实信息，不要编造。',
      },
      {
        role: 'user',
        content: `请搜索网络了解"${companyName}"这家公司的信息，然后严格按照以下JSON格式返回（不要markdown标记，不要其他文字）：\n{"industry": "所属行业", "business": "主要业务（50字以内）", "company_info": "公司简介（100字以内）"}\n如果搜索不到真实信息，字段设为null。`,
      },
    ],
    temperature: 0.1,
    max_tokens: 1024,
  });

  const text = response.choices[0]?.message?.content || '';
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    const result = JSON.parse(cleaned);
    return {
      industry: result.industry || null,
      business: result.business || null,
      company_info: result.company_info || null,
    };
  } catch (err) {
    // If parsing fails, return null fields — don't block the whole flow
    console.error('Company analysis parse error:', text);
    return { industry: null, business: null, company_info: null };
  }
}
```

---

### Task 4: Upload route (image + OCR + analysis + save)

**Files:**
- Create: `server/src/routes/upload.js`

- [ ] **Step 1: Create server/src/routes/upload.js**

```javascript
import { extractBusinessCard } from '../services/ocr.js';
import { analyzeCompany } from '../services/company-analysis.js';
import { getDb } from '../db/schema.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOAD_DIR = path.resolve(process.cwd(), '..', 'uploads');

export default async function uploadRoutes(fastify) {
  fastify.post('/api/upload', async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: { message: '请上传名片图片' } });
    }

    // Ensure upload dir exists
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    // Save file with unique name
    const ext = path.extname(data.filename) || '.jpg';
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);

    const writeStream = fs.createWriteStream(filePath);
    await data.file.pipe(writeStream);

    // Wait for write to finish
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Step 1: OCR — extract card info from image
    let cardInfo;
    try {
      cardInfo = await extractBusinessCard(filePath);
    } catch (err) {
      // Clean up file on failure
      fs.unlinkSync(filePath);
      return reply.status(422).send({ error: { message: `名片识别失败: ${err.message}` } });
    }

    if (!cardInfo.name && !cardInfo.company && !cardInfo.phone) {
      fs.unlinkSync(filePath);
      return reply.status(422).send({ error: { message: '无法从图片中识别出名片信息，请确认图片清晰且包含名片' } });
    }

    // Step 2: Company analysis — search web for company info
    let analysis = { industry: null, business: null, company_info: null };
    if (cardInfo.company) {
      try {
        analysis = await analyzeCompany(cardInfo.company);
      } catch (err) {
        // Non-fatal — card still saved without company analysis
        console.error('Company analysis failed:', err.message);
      }
    }

    // Step 3: Save to DB
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO cards (name, company, phone, email, industry, business, company_info, image_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      cardInfo.name || '未知',
      cardInfo.company || null,
      cardInfo.phone || null,
      cardInfo.email || null,
      analysis.industry || null,
      analysis.business || null,
      analysis.company_info || null,
      uniqueName
    );

    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid);

    return { card };
  });

  // Also serve uploaded images
  fastify.get('/uploads/:filename', async (req, reply) => {
    return reply.sendFile(req.params.filename);
  });
}
```

---

### Task 5: Cards CRUD + search routes

**Files:**
- Create: `server/src/routes/cards.js`

- [ ] **Step 1: Create server/src/routes/cards.js**

```javascript
import { getDb } from '../db/schema.js';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.resolve(process.cwd(), '..', 'uploads');

export default async function cardRoutes(fastify) {
  // GET /api/cards — List with search/filter/pagination
  fastify.get('/api/cards', async (req, reply) => {
    const { search, industry, company, tag, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const db = getDb();
    const whereClauses = [];
    const params = [];

    if (search) {
      const pattern = `%${search}%`;
      whereClauses.push('(name LIKE ? OR company LIKE ? OR phone LIKE ? OR email LIKE ?)');
      params.push(pattern, pattern, pattern, pattern);
    }

    if (industry) {
      whereClauses.push('industry = ?');
      params.push(industry);
    }

    if (company) {
      whereClauses.push('company = ?');
      params.push(company);
    }

    if (tag) {
      whereClauses.push('tags LIKE ?');
      params.push(`%"${tag}"%`);
    }

    const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM cards ${whereStr}`).get(...params);
    const cards = db.prepare(`SELECT * FROM cards ${whereStr} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limitNum, offset);

    // Parse tags JSON for each card
    const parsed = cards.map(c => ({ ...c, tags: JSON.parse(c.tags || '[]') }));

    return { cards: parsed, total: countRow.total, page: pageNum, limit: limitNum };
  });

  // GET /api/cards/:id — Single card detail
  fastify.get('/api/cards/:id', async (req, reply) => {
    const db = getDb();
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    if (!card) {
      return reply.status(404).send({ error: { message: '名片不存在' } });
    }
    card.tags = JSON.parse(card.tags || '[]');
    return { card };
  });

  // PUT /api/cards/:id — Update card
  fastify.put('/api/cards/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          company: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          industry: { type: 'string' },
          business: { type: 'string' },
          company_info: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (req, reply) => {
    const { name, company, phone, email, industry, business, company_info, tags } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    if (!existing) {
      return reply.status(404).send({ error: { message: '名片不存在' } });
    }

    db.prepare(`
      UPDATE cards SET name = ?, company = ?, phone = ?, email = ?,
        industry = ?, business = ?, company_info = ?, tags = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ?? existing.name,
      company ?? existing.company,
      phone ?? existing.phone,
      email ?? existing.email,
      industry ?? existing.industry,
      business ?? existing.business,
      company_info ?? existing.company_info,
      JSON.stringify(tags ?? JSON.parse(existing.tags || '[]')),
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    updated.tags = JSON.parse(updated.tags || '[]');
    return { card: updated };
  });

  // DELETE /api/cards/:id — Delete card and image
  fastify.delete('/api/cards/:id', async (req, reply) => {
    const db = getDb();
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    if (!card) {
      return reply.status(404).send({ error: { message: '名片不存在' } });
    }

    // Delete image file
    if (card.image_path) {
      const filePath = path.join(UPLOAD_DIR, card.image_path);
      try { fs.unlinkSync(filePath); } catch (e) { /* file already gone */ }
    }

    db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
    return { success: true };
  });
}
```

---

### Task 6: Client scaffolding + API service

**Files:**
- Create: `client/package.json`
- Create: `client/vite.config.js`
- Create: `client/index.html`
- Create: `client/src/main.jsx`
- Create: `client/src/App.css`
- Create: `client/src/services/api.js`

- [ ] **Step 1: Create client/package.json**

```json
{
  "name": "business-card-client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.28.0",
    "antd": "^5.22.0",
    "@ant-design/icons": "^5.5.0",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create client/vite.config.js**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
});
```

- [ ] **Step 3: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>名片管理工具</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create client/src/main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
```

- [ ] **Step 5: Create client/src/App.css**

```css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f5f5;
}

.app-header {
  background: #fff;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  height: 56px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.app-header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.app-content {
  max-width: 1200px;
  margin: 24px auto;
  padding: 0 24px;
}

.card-preview-img {
  width: 80px;
  height: 56px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
}
```

- [ ] **Step 6: Create client/src/services/api.js**

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s — OCR can be slow
});

export async function getCards(params = {}) {
  const res = await api.get('/cards', { params });
  return res.data;
}

export async function getCard(id) {
  const res = await api.get(`/cards/${id}`);
  return res.data;
}

export async function uploadCard(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/upload', formData);
  return res.data;
}

export async function updateCard(id, data) {
  const res = await api.put(`/cards/${id}`, data);
  return res.data;
}

export async function deleteCard(id) {
  const res = await api.delete(`/cards/${id}`);
  return res.data;
}
```

- [ ] **Step 7: Install dependencies**

```bash
cd /Users/xishatang/Desktop/606/client && npm install
```

---

### Task 7: CardList page

**Files:**
- Create: `client/src/pages/CardList.jsx`

- [ ] **Step 1: Create client/src/pages/CardList.jsx**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Select, Tag, Space, Button, Image, message } from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import { getCards, deleteCard } from '../services/api';

export default function CardList() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState(undefined);
  const [companyFilter, setCompanyFilter] = useState(undefined);
  const [page, setPage] = useState(1);
  const [industries, setIndustries] = useState([]);
  const [companies, setCompanies] = useState([]);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (industryFilter) params.industry = industryFilter;
      if (companyFilter) params.company = companyFilter;

      const data = await getCards(params);
      setCards(data.cards || []);
      setTotal(data.total || 0);
    } catch (err) {
      message.error('加载名片列表失败');
    } finally {
      setLoading(false);
    }
  }, [search, industryFilter, companyFilter, page]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Load filter options on mount
  useEffect(() => {
    getCards({ limit: 1 }).then(() => {
      // Fetch distinct industries and companies for filter dropdowns
      getCards({ limit: 1000 }).then(data => {
        const items = data.cards || [];
        setIndustries([...new Set(items.map(c => c.industry).filter(Boolean))]);
        setCompanies([...new Set(items.map(c => c.company).filter(Boolean))]);
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  const handleDelete = (id, name) => {
    if (!window.confirm(`确定删除"${name}"的名片？`)) return;
    deleteCard(id).then(() => {
      message.success('已删除');
      fetchCards();
    }).catch(() => message.error('删除失败'));
  };

  const columns = [
    {
      title: '头像',
      dataIndex: 'image_path',
      key: 'image',
      width: 100,
      render: (path) => path ? (
        <Image
          src={`/uploads/${path}`}
          width={72}
          height={50}
          style={{ objectFit: 'cover', borderRadius: 4 }}
          preview={{ mask: '预览' }}
        />
      ) : <div style={{ width: 72, height: 50, background: '#f0f0f0', borderRadius: 4 }} />,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <a onClick={() => navigate(`/cards/${record.id}`)}>{name}</a>
      ),
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: '行业',
      dataIndex: 'industry',
      key: 'industry',
      render: (v) => v ? <Tag color="blue">{v}</Tag> : null,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags) => (tags || []).map(t => <Tag key={t}>{t}</Tag>),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record.id, record.name)}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Input.Search
          placeholder="搜索姓名、公司、电话、邮箱"
          allowClear
          onSearch={(val) => { setSearch(val); setPage(1); }}
          style={{ width: 280 }}
          prefix={<SearchOutlined />}
        />
        <Select
          placeholder="按行业筛选"
          allowClear
          style={{ width: 160 }}
          value={industryFilter}
          onChange={(val) => { setIndustryFilter(val); setPage(1); }}
          options={industries.map(i => ({ label: i, value: i }))}
        />
        <Select
          placeholder="按公司筛选"
          allowClear
          style={{ width: 200 }}
          value={companyFilter}
          onChange={(val) => { setCompanyFilter(val); setPage(1); }}
          options={companies.map(c => ({ label: c, value: c }))}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/upload')}
        >
          上传名片
        </Button>
      </div>

      <Table
        dataSource={cards}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: setPage,
          showTotal: (t) => `共 ${t} 张名片`,
        }}
        locale={{ emptyText: '暂无名片，点击"上传名片"开始添加' }}
      />
    </div>
  );
}
```

---

### Task 8: CardUpload page

**Files:**
- Create: `client/src/pages/CardUpload.jsx`

- [ ] **Step 1: Create client/src/pages/CardUpload.jsx**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Card, Descriptions, Tag, Button, Spin, Space, message, Result } from 'antd';
import { InboxOutlined, ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { uploadCard } from '../services/api';

const { Dragger } = Upload;

export default function CardUpload() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async (file) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await uploadCard(file);
      setResult(data.card);
      message.success('名片识别成功！');
    } catch (err) {
      const msg = err.response?.data?.error?.message || '上传或识别失败，请重试';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
    return false; // Prevent default upload behavior
  };

  const resetUpload = () => {
    setResult(null);
    setError(null);
  };

  // If upload succeeded, show result
  if (result) {
    return (
      <Card title={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
          <span>识别结果</span>
        </Space>
      }>
        <Result
          status="success"
          title="名片识别完成"
          subTitle={`已成功识别「${result.name}」的名片信息`}
          extra={[
            <Button key="view" type="primary" onClick={() => navigate(`/cards/${result.id}`)}>
              查看详情
            </Button>,
            <Button key="again" icon={<PlusOutlined />} onClick={resetUpload}>
              继续上传
            </Button>,
          ]}
        />
        <Descriptions bordered column={1} style={{ marginTop: 16 }}>
          <Descriptions.Item label="姓名">{result.name}</Descriptions.Item>
          <Descriptions.Item label="公司">{result.company || '-'}</Descriptions.Item>
          <Descriptions.Item label="电话">{result.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{result.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="行业">
            {result.industry ? <Tag color="blue">{result.industry}</Tag> : '分析中...'}
          </Descriptions.Item>
          <Descriptions.Item label="业务">{result.business || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回列表</Button>
      </Space>

      <Card title="上传名片">
        <Spin spinning={loading} tip="正在识别名片信息...">
          <Dragger
            name="file"
            multiple={false}
            accept="image/jpeg,image/png,image/webp"
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={loading}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽名片图片到此区域上传</p>
            <p className="ant-upload-hint">
              支持 JPG / PNG / WebP 格式，单张不超过 10MB
            </p>
          </Dragger>
        </Spin>

        {error && (
          <Result
            status="error"
            title="识别失败"
            subTitle={error}
            extra={<Button onClick={resetUpload}>重新上传</Button>}
          />
        )}
      </Card>
    </div>
  );
}
```

---

### Task 9: CardDetail page

**Files:**
- Create: `client/src/pages/CardDetail.jsx`

- [ ] **Step 1: Create client/src/pages/CardDetail.jsx**

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Image, Button, Space, Spin, message,
  Modal, Input, Form, Select,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getCard, updateCard, deleteCard } from '../services/api';

export default function CardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    setLoading(true);
    getCard(id)
      .then(data => setCard(data.card))
      .catch(() => {
        message.error('名片不存在');
        navigate('/');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleEdit = () => {
    form.setFieldsValue({
      name: card.name,
      company: card.company,
      phone: card.phone,
      email: card.email,
      industry: card.industry,
      business: card.business,
      company_info: card.company_info,
      tags: card.tags || [],
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      const values = form.getFieldsValue();
      const data = await updateCard(id, values);
      setCard(data.card);
      setEditing(false);
      message.success('已更新');
    } catch (err) {
      message.error('更新失败');
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: `确定删除「${card.name}」的名片？`,
      content: '此操作不可恢复',
      onOk: async () => {
        await deleteCard(id);
        message.success('已删除');
        navigate('/');
      },
    });
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!card) return null;

  const previewUrl = card.image_path ? `/uploads/${card.image_path}` : null;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回列表</Button>
        <Button icon={<EditOutlined />} onClick={handleEdit}>编辑</Button>
        <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>删除</Button>
      </Space>

      <Card title={`名片 - ${card.name}`}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          {previewUrl && (
            <Image
              src={previewUrl}
              width={200}
              style={{ borderRadius: 8, objectFit: 'contain' }}
              alt="名片图片"
            />
          )}
          <Descriptions bordered column={2} style={{ flex: 1 }}>
            <Descriptions.Item label="姓名">{card.name}</Descriptions.Item>
            <Descriptions.Item label="公司">{card.company || '-'}</Descriptions.Item>
            <Descriptions.Item label="电话">{card.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{card.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="标签">
              {(card.tags || []).map(t => <Tag key={t} color="geekblue">{t}</Tag>)}
              {(!card.tags || card.tags.length === 0) && '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{card.created_at}</Descriptions.Item>
          </Descriptions>
        </div>

        <Card title="AI 公司分析" type="inner" style={{ marginTop: 16 }}>
          {card.industry || card.business ? (
            <Descriptions bordered column={1}>
              <Descriptions.Item label="行业">
                {card.industry ? <Tag color="blue">{card.industry}</Tag> : '未知'}
              </Descriptions.Item>
              <Descriptions.Item label="主要业务">{card.business || '未知'}</Descriptions.Item>
              <Descriptions.Item label="公司简介">{card.company_info || '未知'}</Descriptions.Item>
            </Descriptions>
          ) : (
            <p style={{ color: '#999' }}>无公司信息</p>
          )}
        </Card>
      </Card>

      {/* Edit Modal */}
      <Modal
        title="编辑名片"
        open={editing}
        onOk={handleSave}
        onCancel={() => setEditing(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="company" label="公司">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="industry" label="行业">
            <Input />
          </Form.Item>
          <Form.Item name="business" label="业务">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="company_info" label="公司简介">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

---

### Task 10: App routing + final integration

**Files:**
- Create: `client/src/App.jsx`
- Modify: `server/src/index.js` (add uploads dir creation on startup)

- [ ] **Step 1: Create client/src/App.jsx**

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import CardList from './pages/CardList';
import CardUpload from './pages/CardUpload';
import CardDetail from './pages/CardDetail';

export default function App() {
  return (
    <div>
      <div className="app-header">
        <h1>📇 名片管理</h1>
      </div>
      <div className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/cards" replace />} />
          <Route path="/cards" element={<CardList />} />
          <Route path="/cards/new" element={<CardUpload />} />
          <Route path="/cards/:id" element={<CardDetail />} />
          <Route path="/upload" element={<CardUpload />} />
        </Routes>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Ensure uploads dir is created at server startup**

Modify `server/src/index.js` by adding this line after the `dotenv.config()` call:

```javascript
import fs from 'fs';
// ... (after dotenv.config())
const uploadsDir = path.resolve(process.cwd(), '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
```

- [ ] **Step 3: Start the server and client**

In one terminal:
```bash
cd /Users/xishatang/Desktop/606/server && node src/index.js
```

In another terminal:
```bash
cd /Users/xishatang/Desktop/606/client && npx vite
```

Expected: Server on :3001, Client on :5173. Open http://localhost:5173 — should see the app with header "名片管理" and an empty table.

- [ ] **Step 4: End-to-end test**

1. Open http://localhost:5173
2. Click "上传名片" — navigate to upload page
3. Upload a business card image (JPG/PNG)
4. Wait for OCR processing (may take 5-15s)
5. Verify extracted name/company/phone/email are displayed
6. If company was found, verify industry/business info appears
7. Click "查看详情" — navigate to detail page
8. Click "编辑" — modify a field — save
9. Go back to list — verify search works
10. Test industry filter and company filter
