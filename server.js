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
  } catch (err) {
    console.error(err);
    let msg = err.message || '分析失敗';
    if (/429|quota|rate.?limit/i.test(msg)) {
      msg = 'Gemini 今天免費影片分析的額度已用完（每天會自動重置）。建議：①明天再試 ②換一支較短的影片 ③升級 Gemini 付費方案以解鎖更多額度。';
    } else if (/403|permission/i.test(msg)) {
      msg = '無法存取這支影片（可能是私人或地區限制）。請貼一支公開的 YouTube 連結。';
    }
    res.status(500).json({ error: msg });
  }
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

// ───────── 工具6：提示詞優化（支援上傳圖、產 3 個造型方案）─────────
function parseVariations(text) {
  const out = { imageNotes: '', variations: [] };
  const im = text.match(/===IMAGE_NOTES===\s*([\s\S]*?)(?====VARIATION_1===|$)/);
  if (im) out.imageNotes = im[1].trim();
  for (let i = 1; i <= 3; i++) {
    const re = new RegExp(`===VARIATION_${i}===\\s*TITLE:\\s*(.+?)\\s*NOTE:\\s*([\\s\\S]+?)\\s*PROMPT:\\s*([\\s\\S]*?)(?:===VARIATION_${i + 1}===|$)`);
    const m = text.match(re);
    if (m) out.variations.push({ title: m[1].trim(), note: m[2].trim(), prompt: m[3].trim() });
  }
  return out;
}

app.post('/api/prompt-lab', requireUser, async (req, res) => {
  try {
    const idea = String((req.body || {}).idea || '').trim();
    const tool = String((req.body || {}).tool || '').trim();
    const image = (req.body || {}).image; // optional base64 dataURL
    if (!idea && !image) return res.status(400).json({ error: '請輸入想法或上傳一張參考圖。' });
    if (!tool) return res.status(400).json({ error: '請選擇目標 AI 工具。' });

    const sys = `You are a senior prompt engineer specializing in visual AI tools. The user will give you:
1) (Optional) A reference image
2) A direction in their own words (e.g. "cinematic realistic still")
3) The target AI tool

Your job:
- IF an image is provided, SILENTLY analyze it deeply — subject, pose, framing, lighting, colors, mood, style cues
- Generate THREE DISTINCT styling/concept variations that share the same subject/composition (if image given) or theme, but differ meaningfully in:
  * styling / wardrobe / look
  * mood / lighting / time of day
  * art direction / aesthetic angle
- Each variation MUST be a complete, paste-ready prompt for the target tool, following that tool's best-practice format.

Tool-specific format rules (apply the matching one):
- Midjourney: comma-separated descriptors (NOT prose). Subject → style → mood → lighting → composition. Parameters at end (--ar 16:9 --v 6 --style raw). Use --no for negatives.
- Nano Banana: prose, specify character/scene/style/lighting. "no text in image unless specified".
- DALL-E 3: prose, separate foreground/midground/background.
- Stable Diffusion: (word:weight) syntax, mandatory negative prompt, CFG 7-12.
- SeeDream: art-style keyword first, then scene, mood, atmosphere. Negative prompt.
- Sora / Runway / Kling / Higgsfield / Seedance (video): describe as if directing a shot — camera movement, shot type, motion intensity.
- ChatGPT / Claude / Gemini (chat): role assignment + explicit output format + concrete deliverable.

OUTPUT FORMAT — use these EXACT dividers (use Traditional Chinese for TITLE and NOTE; keep the actual PROMPT in the appropriate language for that tool, usually English):

===IMAGE_NOTES===
[If image given: 1–3 lines of your observations in Traditional Chinese. If no image: write 「(無參考圖)」.]

===VARIATION_1===
TITLE: [4–10 chars, memorable, in Traditional Chinese, e.g. 「黑色電影夜雨版」]
NOTE: [1 line in Traditional Chinese — what makes THIS version distinct]
PROMPT:
[the complete ready-to-paste prompt for the target tool]

===VARIATION_2===
TITLE: ...
NOTE: ...
PROMPT:
...

===VARIATION_3===
TITLE: ...
NOTE: ...
PROMPT:
...

HARD RULES:
- The three variations MUST feel different — don't just swap a word
- Each PROMPT must stand alone and be paste-ready
- No preamble. No closing remarks. Output ONLY the format above.`;

    const userText = `目標工具 / Target tool: ${tool}\n\n方向 / Direction: ${idea || '(請依參考圖自由發揮，做出三個不同造型)'}`;
    const userContent = image
      ? [{ type: 'text', text: userText }, { type: 'image_url', image_url: { url: image } }]
      : userText;

    const raw = await ai.chat([{ role: 'system', content: sys }, { role: 'user', content: userContent }]);
    const parsed = parseVariations(raw);
    res.json({ text: raw, ...parsed, demo: !ai.isConfigured() });
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
