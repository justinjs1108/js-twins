# JS_TWINS

黑白電影感創作者平台 —— 六大工具，邀請碼登入，資料雲端共用永久保存。

## 🧰 工具
1. **劇本編輯室** — 五步驟（發想 → 結構 → 分場 → 成稿 → 分鏡）
2. **Prompt 整理** — Midjourney × Nano Banana 提示詞庫
3. **記事本** — 會議紀錄與重點
4. **預告解析** — 貼 YouTube 連結 → AI 分析故事架構、鏡頭剪接、節奏
5. **台詞翻譯** — 中文 → 口語化電影英文台詞
6. **提示詞優化** — 粗略想法 → 工具專屬的優化提示詞

## 🏗️ 技術棧
- **後端**：Node.js + Express
- **AI**：Gemini（OpenAI 相容層 + 原生 API 給影片用）
- **資料庫**：Supabase（PostgreSQL）
- **登入**：邀請碼（管理員產生、共用工作區）
- **前端**：純 HTML / CSS / JS（無框架）

## 📝 環境變數
請在 Render 或本機 `.env` 設定：

```
# AI（Gemini OpenAI-compatible）
AI_API_KEY=...
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_MODEL=gemini-2.0-flash
AI_FALLBACK_MODEL=gemini-1.5-flash

# 登入 cookie 簽章（自己產一組長隨機字串）
AUTH_SECRET=...

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...

# 影片分析模型（選填）
GEMINI_VIDEO_MODEL=gemini-2.0-flash
```

## 🚀 本機跑
```
npm install
npm start
# → http://localhost:3100
```

## 🔐 第一次登入
管理員代碼從 Supabase SQL 編輯器產生：

```sql
insert into invite_codes (code, label, is_admin)
values (
  upper(substr(md5(random()::text),1,3)||'-'||substr(md5(random()::text),1,4)||'-'||substr(md5(random()::text),1,3)),
  '管理員（你）', true
) returning code as "你的管理員代碼";
```

登入後到 `/admin/` 可產生給其他人用的邀請碼。
