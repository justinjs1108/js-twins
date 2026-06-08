// ============================================================
//  JS_TWINS — 平台主伺服器
//  啟動： npm install  然後  npm start   →   http://localhost:3100
//  登入：邀請碼（管理員產生發給朋友）。資料存 Supabase（共用、永久）。
// ============================================================
require('dotenv').config();
const path = require('path');
const express = require('express');

const { FORMATS, GENRES, STRUCTURES } = require('./lib/structures');
const prompts = require('./lib/prompts');
const ai = require('./lib/ai');
const gemini = require('./lib/gemini'); // 原生 Gemini（給預告解析影片用）
const auth = require('./lib/auth');   // 簽章 cookie（這裡用來存「登入用的邀請碼」）
const supa = require('./lib/supa');   // 雲端資料庫 + 邀請碼

const app = express();
const PORT = process.env.PORT || 3100;

app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'JS_TWINS', db: supa.configured() }));

// ───────── 中介層 ─────────
async function requireUser(req, res, next) {
  const code = auth.currentUser(req); // cookie 裡存的是邀請碼
  if (!code) return res.status(401).json({ error: '請先登入。' });
  try {
    const c = await supa.lookupCode(code);
    if (!c) return res.status(403).json({ error: '你的邀請碼已被撤銷，請聯絡管理員。' });
    req.code = c.code; req.label = c.label; req.isAdmin = c.is_admin; next();
  } catch (e) { res.status(500).json({ error: '驗證失敗。' }); }
}
async function requireAdmin(req, res, next) {
  await requireUser(req, res, () => {
    if (!req.isAdmin) return res.status(403).json({ error: '需要管理員權限。' });
    next();
  });
}

// ───────── 登入（邀請碼）─────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const code = String((req.body && req.body.code) || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: '請輸入邀請碼。' });
    const c = await supa.lookupCode(code);
    if (!c) return res.status(401).json({ error: '邀請碼錯誤或已被撤銷。' });
    await supa.touchCode(code);
    auth.setAuthCookie(res, code, true);
    res.json({ label: c.label, isAdmin: c.is_admin });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message || '登入失敗' }); }
});

app.get('/api/auth/me', async (req, res) => {
  const code = auth.currentUser(req);
  if (!code) return res.json({ user: null });
  try {
    const c = await supa.lookupCode(code);
    if (!c) return res.json({ user: null });
    res.json({ user: c.label, isAdmin: c.is_admin });
  } catch (e) { res.json({ user: null }); }
});

app.post('/api/auth/logout', (req, res) => { auth.clearAuthCookie(res); res.json({ ok: true }); });

// ───────── 管理員：邀請碼管理 ─────────
app.get('/api/admin/codes', requireAdmin, async (req, res) => {
  try { res.json({ list: await supa.listCodes() }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/codes', requireAdmin, async (req, res) => {
  try { res.json({ ok: true, ...(await supa.createCode((req.body || {}).label)) }); } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/api/admin/codes/revoke', requireAdmin, async (req, res) => {
  try {
    const code = String((req.body || {}).code || '').trim().toUpperCase();
    if (code === req.code) return res.status(400).json({ error: '不能撤銷自己正在用的代碼。' });
    await supa.revokeCode(code); res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/admin/codes', requireAdmin, async (req, res) => {
  try {
    const code = String((req.body || {}).code || '').trim().toUpperCase();
    if (code === req.code) return res.status(400).json({ error: '不能刪除自己正在用的代碼。' });
    await supa.deleteCode(code); res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ───────── 共用資料 items ─────────
app.get('/api/items', requireUser, async (req, res) => {
  try { res.json({ items: await supa.listItems(String(req.query.kind || '')) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/items', requireUser, async (req, res) => {
  try {
    const { kind, data } = req.body || {};
    if (!kind) return res.status(400).json({ error: '缺少 kind。' });
    res.json({ item: await supa.createItem(kind, data || {}, req.label) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/items/:id', requireUser, async (req, res) => {
  try { res.json({ item: await supa.updateItem(req.params.id, (req.body || {}).data || {}) }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/items/:id', requireUser, async (req, res) => {
  try { await supa.deleteItem(req.params.id); res.json({ ok: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ───────── 工具1：劇本編輯室（AI；需登入）─────────
app.get('/api/structures', (req, res) => res.json({ formats: FORMATS, genres: GENRES, structures: STRUCTURES }));
app.get('/api/status', (req, res) => res.json({ aiConfigured: ai.isConfigured(), model: ai.MODEL }));

app.post('/api/generate', requireUser, async (req, res) => {
  try {
    const { stage, project } = req.body || {};
    if (!stage || !project) return res.status(400).json({ error: '缺少 stage 或 project 參數。' });
    const messages = prompts.build(stage, project);
    const text = await ai.chat(messages);
    res.json({ text, demo: !ai.isConfigured() });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message || '生成失敗' }); }
});

app.post('/api/assist', requireUser, async (req, res) => {
  try {
    const { mode, instruction, currentText, stageLabel, structureBeats } = req.body || {};
    const messages = prompts.assist({ mode, instruction, currentText, stageLabel, structureBeats });
    const text = await ai.chat(messages);
    res.json({ text });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message || '助手出錯' }); }
});

// ───────── 工具4：預告解析（YouTube → Gemini 視訊分析）─────────
app.post('/api/trailer-analyze', requireUser, async (req, res) => {
  try {
    const url = String((req.body || {}).url || '').trim();
    if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url)) {
      return res.status(400).json({ error: '請貼一個 YouTube 連結（youtube.com 或 youtu.be）。' });
    }
    const systemPrompt = `你是一位專業電影分析師與剪接師。針對使用者提供的預告片或短影片，從劇本創作者的角度，仔細看完整支影片後做深入分析。永遠以繁體中文回答，文字要精準、實用、可被劇本創作者直接吸收套用。`;
    const userPrompt = `請完整看完這支影片，並依下列「四個段落」分析。**用繁體中文**，每個段落用三級標題開頭，內容用條列。

【一、故事架構 Story Structure】
- 用一句話 logline 概括這支預告在賣什麼故事
- 標出可辨識的敘事結構（三幕、Save the Cat 節拍、英雄旅程…），列出每段對應的時間點（mm:ss）
- 主要角色的慾望／障礙／代價

【二、鏡頭與剪接 Shots & Editing】
- 列出 6–10 顆最關鍵的鏡頭：時間（mm:ss）｜景別（特寫/全景…）｜運鏡（推/拉/搖/手持…）｜畫面內容
- 剪接節奏：哪邊用快切？哪邊長鏡頭？轉場手法？
- 影像語言：色調、光線、構圖的特色

【三、整體節奏 Pacing】
- 把預告切 3–4 段，描述每段的節奏曲線（鋪陳→上升→高潮→收尾）
- 哪一秒是「鉤子」（一定要抓住觀眾的點）？哪一秒是「高潮」？
- 配樂、聲音設計如何疊出節奏？

【四、可套用到我的劇本 Takeaways】
- 列 3–5 個「下次寫劇本可以偷學的招」，每招都要可以**馬上拿去用**（例如：第一場戲用 X 手法製造鉤子；用 Y 種剪接過渡兩段時間線；…）`;
    const text = await gemini.analyzeYouTube(url, systemPrompt, userPrompt);
    res.json({ text });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message || '分析失敗' }); }
});

// ───────── 工具5：台詞翻譯（中→英，口語電影台詞風）─────────
app.post('/api/dialogue', requireUser, async (req, res) => {
  try {
    const text = String((req.body || {}).text || '').trim();
    const context = String((req.body || {}).context || '').trim();
    if (!text) return res.status(400).json({ error: '請輸入要翻譯的中文台詞。' });
    const sys = `You are an award-winning film dialogue translator. Convert Chinese movie dialogue into NATURAL, COLLOQUIAL spoken English — the way real people talk on screen, NOT formal translation.

Rules (apply ALL):
- Use contractions (don't, I'm, gonna, wanna, ain't where appropriate to the character)
- Vary sentence length — short punchy lines mixed with longer ones; never uniform
- Cut every AI tell: no "delves into", no "tapestry", no "navigate", no "in the realm of", no over-explanation
- Preserve subtext — what's said vs. what's meant
- Keep the original character voice (rough character stays rough; refined stays refined)
- Output ONLY the translated dialogue, in the same line structure as input (one Chinese line → one English line)
- Format each line as: "Speaker: line" if a speaker label is present in input; otherwise just the line
- Never add stage directions or notes unless the input has them in parentheses`;
    const user = (context ? `Context / characters / tone:\n${context}\n\n---\n\n` : '') + `Translate to colloquial English film dialogue:\n\n${text}`;
    const out = await ai.chat([{ role: 'system', content: sys }, { role: 'user', content: user }]);
    res.json({ text: out, demo: !ai.isConfigured() });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message || '翻譯失敗' }); }
});

// ───────── 工具6：提示詞優化（套 prompt-master 腦袋）─────────
app.post('/api/prompt-lab', requireUser, async (req, res) => {
  try {
    const idea = String((req.body || {}).idea || '').trim();
    const tool = String((req.body || {}).tool || '').trim();
    if (!idea) return res.status(400).json({ error: '請輸入你的粗略想法。' });
    if (!tool) return res.status(400).json({ error: '請選擇目標 AI 工具。' });
    const sys = `You are a senior prompt engineer. Take the user's rough idea, identify the target AI tool, extract the actual intent, and output a SINGLE production-ready prompt optimized for that specific tool with zero wasted tokens.

Tool-specific rules — apply the ones that fit the target tool:
- Midjourney: comma-separated descriptors (NOT prose). Subject first, then style/mood/lighting/composition. Parameters at end (--ar 16:9 --v 6 --style raw). Use --no for negatives.
- Nano Banana / image character work: prose description, specify character details + scene + style + lighting. Include "no text in image unless specified".
- Stable Diffusion: (word:weight) syntax, mandatory negative prompt, CFG 7-12.
- DALL-E 3: prose, separate foreground/midground/background for complex scenes.
- Sora / Runway / Kling (video): describe as if directing — specify camera movement (static/dolly/crane), shot type, motion intensity.
- ChatGPT / GPT-5.x: explicit output contract (format, length, "done" criteria). Compact structured instructions.
- Claude: be literal and explicit, use XML tags for multi-section (<context><task><constraints><output_format>). State WHY not just WHAT.
- Gemini: add "Cite only sources you're certain of. If uncertain, say [uncertain]" for factual tasks.
- Cursor / Windsurf / Claude Code: file path + function + current behavior + desired change + do-not-touch list + "Done when:" criteria.

Output format — STRICTLY this shape, in Traditional Chinese for labels:

【優化後的提示詞】
\`\`\`
<the actual prompt, ready to paste>
\`\`\`

🎯 目標工具：<tool name>
💡 重點優化：<one sentence — what was tightened and why>

(若需要設定步驟才能貼上，加 1–2 行繁中說明；不需要就省略。)

Hard rules:
- Output ONLY this format. No theory, no framework names, no preamble.
- Use the strongest signal words (MUST > should, NEVER > avoid).
- Critical constraints must appear in the first 30% of the generated prompt.`;
    const user = `目標工具：${tool}\n\n粗略想法：${idea}`;
    const out = await ai.chat([{ role: 'system', content: sys }, { role: 'user', content: user }]);
    res.json({ text: out, demo: !ai.isConfigured() });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message || '優化失敗' }); }
});

app.listen(PORT, () => {
  console.log('────────────────────────────────────────');
  console.log('🎬  JS_TWINS 平台已啟動');
  console.log(`🌐  http://localhost:${PORT}`);
  console.log(`🤖  AI： ${ai.isConfigured() ? '已連線（' + ai.MODEL + '）' : '示範模式'}`);
  console.log(`🗄️  資料庫： ${supa.configured() ? 'Supabase 已連線' : '未設定'}`);
  console.log('────────────────────────────────────────');
});
