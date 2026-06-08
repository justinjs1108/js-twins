// ============================================================
//  劇本編輯室 Script Studio — 前端邏輯（JS_TWINS 版）
//  無開場、無登入，直接進入。五步驟以 stepper 切換。
// ============================================================

const STAGES = {
  brainstorm: { key: 'brainstormResult', title: '發想 · 高概念腦力激盪', desc: '根據你的類型與想法，腦爆出 4 個高概念故事點子。挑一個最愛的，把它的「故事前提」貼回上面的 Logline 欄位。' },
  structure:  { key: 'structureResult',  title: '結構 · 套用敘事骨架',   desc: '挑一個得獎電影常用的結構模板，讓系統把你的故事填進每一個節拍。' },
  scenes:     { key: 'scenesResult',     title: '分場 · 展開場次大綱',   desc: '把結構大綱展開成一場一場的分場表（含景別、本場目的）。' },
  screenplay: { key: 'screenplayResult', title: '成稿 · 寫成正式劇本',   desc: '挑關鍵幾場，寫成正式電影劇本格式（含對白與動作描述）。' },
  shooting:   { key: 'shootingResult',   title: '分鏡腳本 · 逐鏡頭設計', desc: '把劇本片段轉成逐鏡頭的分鏡表（景別、運鏡、聲音、秒數）。' },
};
const STAGE_ORDER = ['brainstorm', 'structure', 'scenes', 'screenplay', 'shooting'];

let project = load();
let currentStage = 'brainstorm';
let structures = [];

// 等登入守門員把使用者撈出來，再啟動 App（沒登入會被 guard.js 導去 /login）
document.addEventListener('jstwins-auth', (e) => { window.__USER__ = e.detail; boot(); });
if (window.__USER__) boot();
async function boot() {
  if (window.__BOOTED__) return; window.__BOOTED__ = true;
  const who = document.getElementById('who'); if (who && window.__USER__) who.textContent = '👤 ' + window.__USER__.user;
  startDust();
  bindEvents();
  bindAssist();
  await loadStatus();
  await loadLibrary();
  fillSetupFromProject();
  renderStage();
  renderSaves();
  renderAssistStructs();
}

// ---- localStorage ----
function save() { localStorage.setItem('js-twins-script', JSON.stringify(project)); }
function load() { try { return JSON.parse(localStorage.getItem('js-twins-script')) || {}; } catch (e) { return {}; } }

// ---- AI 狀態 ----
async function loadStatus() {
  try {
    const s = await (await fetch('/api/status')).json();
    const badge = document.getElementById('ai-badge');
    if (s.aiConfigured) { badge.textContent = '● 系統已連線'; badge.className = 'badge live'; }
    else { badge.textContent = '● 示範模式'; badge.className = 'badge'; }
  } catch (e) {}
}

// ---- 結構模板庫 ----
async function loadLibrary() {
  const data = await (await fetch('/api/structures')).json();
  structures = data.structures;
  const formatSel = document.getElementById('format');
  formatSel.innerHTML = '<option value="">— 請選擇 —</option>' +
    data.formats.map((f) => `<option value="${f.id}">${f.name} ${f.nameEn}（${f.length}）</option>`).join('');
  document.getElementById('genres').innerHTML = data.genres
    .map((g) => `<span class="chip" data-genre="${g}">${g}</span>`).join('');
  renderStructureSelect();
}

function renderStructureSelect() {
  const sel = document.getElementById('structure-select');
  let opts = structures.map((s) => {
    const star = project.format && s.formats.includes(project.format) ? '⭐ ' : '';
    return `<option value="${s.id}">${star}${s.name}</option>`;
  }).join('');
  if (project.customStructure) opts = `<option value="custom">🎬 ${project.customStructure.name}</option>` + opts;
  sel.innerHTML = opts;
  if (project.structureId) sel.value = project.structureId; else project.structureId = sel.value;
  renderStructureInfo();
}

function renderStructureInfo() {
  const box = document.getElementById('structure-info');
  if (project.structureId === 'custom' && project.customStructure) {
    box.innerHTML = `<h4>🎬 ${project.customStructure.name}</h4><div class="meta">參照你提供的電影分析出來的結構</div><div>${renderContent(project.customStructure.beatsText)}</div>`;
    return;
  }
  const s = structures.find((x) => x.id === project.structureId);
  if (!s) { box.innerHTML = ''; return; }
  box.innerHTML = `<h4>${s.name}</h4><div class="meta">原名 ${s.nameEn}　·　${s.author}<br>🎯 ${s.bestFor}<br>🎞️ 代表作：${s.examples.join('、')}</div><div>${s.summary}</div><ol>${s.beats.map((b) => `<li><b>${b.name}</b>：${b.desc}</li>`).join('')}</ol>`;
}

async function analyzeMovieStructure() {
  const input = document.getElementById('movie-input').value.trim();
  const status = document.getElementById('analyze-status');
  if (!input) { status.textContent = '⚠️ 請先輸入電影名稱'; return; }
  const btn = document.getElementById('analyze-btn');
  btn.disabled = true; btn.textContent = '⏳ 分析中…'; status.textContent = '';
  try {
    project.movieInput = input;
    const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'analyzeMovie', project }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '分析失敗');
    project.customStructure = { name: '參照：' + input, beatsText: data.text };
    project.structureId = 'custom'; save(); renderStructureSelect();
    status.textContent = '✓ 已分析，並設為目前結構';
  } catch (e) { status.textContent = '❌ ' + e.message; }
  finally { btn.disabled = false; btn.textContent = '分析電影結構並套用'; }
}

// ---- 事件 ----
function bindEvents() {
  document.getElementById('title').addEventListener('input', (e) => { project.title = e.target.value; save(); });
  document.getElementById('idea').addEventListener('input', (e) => { project.idea = e.target.value; save(); });
  document.getElementById('logline').addEventListener('input', (e) => { project.logline = e.target.value; save(); });
  document.getElementById('format').addEventListener('change', (e) => { project.format = e.target.value; save(); renderStructureSelect(); });
  document.getElementById('genres').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip'); if (!chip) return;
    chip.classList.toggle('on');
    const g = chip.dataset.genre; project.genres = project.genres || [];
    if (chip.classList.contains('on')) project.genres.push(g); else project.genres = project.genres.filter((x) => x !== g);
    save();
  });
  document.getElementById('structure-select').addEventListener('change', (e) => { project.structureId = e.target.value; save(); renderStructureInfo(); });
  document.getElementById('analyze-btn').addEventListener('click', analyzeMovieStructure);
  document.getElementById('movie-input').addEventListener('input', (e) => { project.movieInput = e.target.value; save(); });

  document.getElementById('stepper').addEventListener('click', (e) => {
    const b = e.target.closest('.step'); if (!b) return; switchStage(b.dataset.stage);
    document.querySelector('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('prev-page').addEventListener('click', () => gotoPageDelta(-1));
  document.getElementById('next-page').addEventListener('click', () => gotoPageDelta(1));

  document.getElementById('result').addEventListener('input', (e) => { project[STAGES[currentStage].key] = e.target.value; save(); });
  document.getElementById('generate-btn').addEventListener('click', generate);
  document.getElementById('edit-btn').addEventListener('click', toggleEdit);
  document.getElementById('copy-btn').addEventListener('click', copyResult);
  document.getElementById('export-btn').addEventListener('click', exportMarkdown);
  document.getElementById('reset-btn').addEventListener('click', resetProject);
  document.getElementById('save-current').addEventListener('click', saveCurrent);
}

// ---- 步驟切換 ----
function switchStage(stage) {
  project[STAGES[currentStage].key] = document.getElementById('result').value; save();
  currentStage = stage; renderStage();
}

function renderStage() {
  const meta = STAGES[currentStage];
  const text = project[meta.key] || '';
  document.getElementById('stage-title').textContent = meta.title;
  document.getElementById('stage-desc').textContent = meta.desc;
  document.getElementById('result').value = text;
  document.getElementById('result-view').innerHTML = renderContent(text);
  setEditMode(false);
  document.getElementById('structure-picker').classList.toggle('hidden', currentStage !== 'structure');
  document.getElementById('generate-btn').textContent = currentStage === 'structure' ? '✓ 確認結構並生成' : '執行生成';
  document.getElementById('stage-status').textContent = '';
  const idx = STAGE_ORDER.indexOf(currentStage);
  document.getElementById('prev-page').classList.toggle('hidden', idx === 0);
  document.getElementById('next-page').classList.toggle('hidden', idx === STAGE_ORDER.length - 1);
  document.querySelectorAll('.step').forEach((s) => s.classList.toggle('active', s.dataset.stage === currentStage));
  markDoneSteps();
}

function markDoneSteps() {
  document.querySelectorAll('.step').forEach((s) => {
    s.classList.toggle('done', Boolean((project[STAGES[s.dataset.stage].key] || '').trim()));
  });
}

function gotoPageDelta(d) {
  const ni = STAGE_ORDER.indexOf(currentStage) + d;
  if (ni < 0 || ni > STAGE_ORDER.length - 1) return;
  if (d > 0 && currentStage === 'brainstorm') {
    const lg = (project.logline || document.getElementById('logline').value || '').trim();
    if (!lg) { document.getElementById('stage-status').textContent = '⚠️ 請先在上面填入「選定的故事前提 Logline」再進下一步'; document.getElementById('logline').focus(); return; }
  }
  const next = STAGE_ORDER[ni];
  const autoGen = d > 0 && next !== 'structure';
  switchStage(next);
  if (autoGen && !(project[STAGES[next].key] || '').trim()) generate();
  document.querySelector('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- 生成 ----
async function generate() {
  const btn = document.getElementById('generate-btn'), status = document.getElementById('stage-status');
  project[STAGES[currentStage].key] = document.getElementById('result').value;
  if (currentStage !== 'brainstorm' && !(project.logline || '').trim()) status.textContent = '⚠️ 建議先填「Logline」，生成會更準。';
  else status.textContent = '';
  btn.disabled = true; btn.textContent = '⏳ 生成中…';
  try {
    const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: currentStage, project }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '生成失敗');
    document.getElementById('result').value = data.text;
    project[STAGES[currentStage].key] = data.text; save();
    document.getElementById('result-view').innerHTML = renderContent(data.text);
    setEditMode(false); markDoneSteps();
    status.textContent = data.demo ? '✓ 完成（示範模式）' : '✓ 完成';
  } catch (err) { status.textContent = '❌ ' + err.message; }
  finally { btn.disabled = false; btn.textContent = currentStage === 'structure' ? '✓ 確認結構並生成' : '執行生成'; }
}

function copyResult() {
  const txt = project[STAGES[currentStage].key] || document.getElementById('result').value;
  navigator.clipboard.writeText(txt).then(() => { document.getElementById('stage-status').textContent = '⧉ 已複製到剪貼簿'; });
}

function exportMarkdown() {
  project[STAGES[currentStage].key] = document.getElementById('result').value;
  const s = structures.find((x) => x.id === project.structureId);
  const lines = [
    `# ${project.title || '未命名劇本'}`, '',
    `- 片長/形式：${project.format || '—'}`,
    `- 類型：${(project.genres || []).join('、') || '—'}`,
    `- 結構模板：${s ? s.name + ' ' + s.nameEn : '—'}`,
    `- Logline：${project.logline || '—'}`, '',
    '## 💡 發想', '', project.brainstormResult || '（無）', '',
    '## 🏗️ 結構', '', project.structureResult || '（無）', '',
    '## 🎬 分場', '', project.scenesResult || '（無）', '',
    '## 📝 成稿', '', project.screenplayResult || '（無）', '',
    '## 🎞️ 分鏡腳本', '', project.shootingResult || '（無）', '',
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = (project.title || 'script') + '.md'; a.click(); URL.revokeObjectURL(a.href);
}

function resetProject() {
  if (!confirm('確定要清空整個專案嗎？此動作無法復原。')) return;
  project = {}; save(); location.reload();
}

function fillSetupFromProject() {
  document.getElementById('title').value = project.title || '';
  document.getElementById('idea').value = project.idea || '';
  document.getElementById('logline').value = project.logline || '';
  document.getElementById('movie-input').value = project.movieInput || '';
  if (project.format) document.getElementById('format').value = project.format;
  (project.genres || []).forEach((g) => {
    const chip = document.querySelector(`.chip[data-genre="${CSS.escape(g)}"]`); if (chip) chip.classList.add('on');
  });
}

// ---- 把生成文字渲染成乾淨 HTML ----
function renderContent(text) {
  if (!text || !text.trim()) return '<p class="empty">〉 尚未生成，按上方「執行生成」開始。</p>';
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = '';
  text.replace(/\r/g, '').split('\n').forEach((raw) => {
    let line = raw.trim();
    if (!line) { html += '<div class="seg-gap"></div>'; return; }
    if (/^[═─—=_．・·-]{4,}$/.test(line)) { html += '<hr class="seg-div">'; return; }
    line = line.replace(/^#{1,6}\s*/, '').replace(/^[-*•]\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/[|*#]/g, '').trim();
    if (!line) return;
    if (/^第[一二三四五六七八九十百零\d]+幕/.test(line)) { html += '<h3 class="seg-act">' + esc(line) + '</h3>'; return; }
    let m = line.match(/^【(.+?)】$/);
    if (m) { html += '<h4 class="seg-title">' + esc(m[1]) + '</h4>'; return; }
    if (/^（.*）$/.test(line)) { html += '<p class="seg-action">' + esc(line) + '</p>'; return; }
    m = line.match(/^([^：:]{1,12})[：:](.*)$/);
    if (m && m[2].trim()) { html += '<p class="seg-row"><span class="seg-label">' + esc(m[1]) + '</span><span class="seg-val">' + esc(m[2].trim()) + '</span></p>'; return; }
    html += '<p class="seg-p">' + esc(line) + '</p>';
  });
  return html;
}

function setEditMode(on) {
  const view = document.getElementById('result-view'), ta = document.getElementById('result'), btn = document.getElementById('edit-btn');
  if (on) { ta.value = project[STAGES[currentStage].key] || ''; ta.classList.remove('hidden'); view.classList.add('hidden'); btn.textContent = '✓ 完成編輯'; ta.focus(); }
  else { project[STAGES[currentStage].key] = ta.value; save(); view.innerHTML = renderContent(ta.value); ta.classList.add('hidden'); view.classList.remove('hidden'); btn.textContent = '編輯'; markDoneSteps(); }
}
function toggleEdit() { setEditMode(document.getElementById('result').classList.contains('hidden')); }

// ============================================================
//  AI 助手
// ============================================================
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function bindAssist() {
  document.getElementById('assist-toggle').addEventListener('click', () => document.getElementById('assist-panel').classList.toggle('hidden'));
  document.getElementById('assist-close').addEventListener('click', () => document.getElementById('assist-panel').classList.add('hidden'));
  document.querySelectorAll('.qchip').forEach((c) => c.addEventListener('click', () => runAssist(c.dataset.mode, c.dataset.ins)));
  document.getElementById('assist-analyze').addEventListener('click', () => runAssist('analyze', document.getElementById('assist-text').value.trim()));
  document.getElementById('assist-rewrite').addEventListener('click', () => runAssist('rewrite', document.getElementById('assist-text').value.trim()));
}

function renderAssistStructs() {
  const box = document.getElementById('assist-structs'); let chips = '';
  if (project.customStructure) chips += `<button class="schip" data-id="custom">🎬 ${escapeHtml(project.customStructure.name)}</button>`;
  chips += structures.map((s) => `<button class="schip" data-id="${s.id}">${s.name}</button>`).join('');
  box.innerHTML = chips;
  box.querySelectorAll('.schip').forEach((c) => c.addEventListener('click', () => restructureWith(c.dataset.id)));
}

function assistAddMsg(role, html) {
  const box = document.getElementById('assist-messages');
  const div = document.createElement('div'); div.className = 'amsg amsg-' + role; div.innerHTML = html;
  box.appendChild(div); box.scrollTop = box.scrollHeight; return div;
}

function attachApply(msgDiv, newText) {
  msgDiv.innerHTML = renderContent(newText) + '<div class="amsg-actions"><button class="btn sm primary apply-btn">✓ 套用到目前步驟</button></div>';
  msgDiv.querySelector('.apply-btn').addEventListener('click', (e) => {
    project[STAGES[currentStage].key] = newText; save();
    document.getElementById('result').value = newText;
    document.getElementById('result-view').innerHTML = renderContent(newText);
    markDoneSteps(); e.target.textContent = '✓ 已套用'; e.target.disabled = true;
  });
}

async function callAssist(payload, loadingDiv, applyable) {
  try {
    const res = await fetch('/api/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '助手出錯');
    if (applyable) attachApply(loadingDiv, data.text); else loadingDiv.innerHTML = renderContent(data.text);
  } catch (e) { loadingDiv.innerHTML = '❌ ' + escapeHtml(e.message); }
}

function runAssist(mode, instruction) {
  if (!instruction) { assistAddMsg('ai', '請先輸入指示，或點上面的快捷鈕。'); return; }
  const currentText = project[STAGES[currentStage].key] || '';
  if (!currentText.trim() && mode === 'rewrite') { assistAddMsg('ai', '目前這個步驟還沒有內容可以改寫，先按「執行生成」吧。'); return; }
  assistAddMsg('user', escapeHtml(instruction));
  const loading = assistAddMsg('ai', '⏳ 思考中…');
  document.getElementById('assist-text').value = '';
  callAssist({ mode, instruction, currentText, stageLabel: STAGES[currentStage].title }, loading, mode === 'rewrite');
}

function restructureWith(id) {
  const currentText = project[STAGES[currentStage].key] || '';
  if (!currentText.trim()) { assistAddMsg('ai', '先在這個步驟生成內容，才能用新結構重寫喔。'); return; }
  let name, beats;
  if (id === 'custom' && project.customStructure) { name = project.customStructure.name; beats = project.customStructure.beatsText; }
  else { const s = structures.find((x) => x.id === id); if (!s) return; name = s.name; beats = s.beats.map((b) => b.name + '：' + b.desc).join('\n'); }
  assistAddMsg('user', '用「' + escapeHtml(name) + '」重新編排');
  const loading = assistAddMsg('ai', '⏳ 重寫中…');
  callAssist({ mode: 'restructure', currentText, structureBeats: '【' + name + '】\n' + beats, stageLabel: STAGES[currentStage].title }, loading, true);
}

// ============================================================
//  我的劇本（雲端，所有人共用）
//  目前正在編輯的草稿仍存在 localStorage（自動保存、打字即存）；
//  按「儲存目前劇本」才會把整份送到雲端，朋友也能看到。
// ============================================================
let savesCache = [];
async function api(path, opts) {
  opts = opts || {}; opts.credentials = 'same-origin';
  opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  const r = await fetch(path, opts); const d = await r.json();
  if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status)); return d;
}

async function renderSaves() {
  const box = document.getElementById('scripts-list');
  try {
    const d = await api('/api/items?kind=script');
    savesCache = d.items || [];
  } catch (e) { box.innerHTML = '<p class="scripts-empty">載入失敗：' + escapeHtml(e.message) + '</p>'; return; }
  if (!savesCache.length) { box.innerHTML = '<p class="scripts-empty">還沒有儲存的劇本。在上面命名後按「儲存目前劇本」。</p>'; return; }
  box.innerHTML = savesCache.map((it) => {
    const d = it.data || {}; const name = d.name || '未命名劇本';
    const when = new Date(it.updated_at || it.created_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const by = it.created_by ? '<span class="script-when">— ' + escapeHtml(it.created_by) + '</span>' : '';
    return `<div class="script-item"><span class="script-name">${escapeHtml(name)}</span><span class="script-when">${when}</span>${by}<button class="btn sm load-script" data-id="${it.id}">載入</button><button class="btn sm ghost danger del-script" data-id="${it.id}">刪除</button></div>`;
  }).join('');
  box.querySelectorAll('.load-script').forEach((b) => b.addEventListener('click', () => loadProject(b.dataset.id)));
  box.querySelectorAll('.del-script').forEach((b) => b.addEventListener('click', () => deleteSaved(b.dataset.id)));
}

async function saveCurrent() {
  const nameInp = document.getElementById('save-name');
  const name = nameInp.value.trim() || (project.title || '未命名劇本');
  project[STAGES[currentStage].key] = document.getElementById('result').value;
  const status = document.getElementById('saves-status');
  status.textContent = '⏳ 儲存到雲端…';
  try {
    await api('/api/items', { method: 'POST', body: JSON.stringify({ kind: 'script', data: { name, project: JSON.parse(JSON.stringify(project)) } }) });
    nameInp.value = ''; status.textContent = '✓ 已儲存「' + name + '」到雲端';
    renderSaves();
  } catch (e) { status.textContent = '❌ ' + e.message; }
}

function loadProject(id) {
  const it = savesCache.find((x) => x.id === id); if (!it) return;
  const name = (it.data && it.data.name) || '未命名劇本';
  if (!confirm('載入「' + name + '」會覆蓋目前正在編輯的內容，確定嗎？')) return;
  project = JSON.parse(JSON.stringify((it.data && it.data.project) || {})); save();
  fillSetupFromProject(); renderStructureSelect(); currentStage = 'brainstorm'; renderStage();
  document.getElementById('saves-status').textContent = '✓ 已載入「' + name + '」';
}

async function deleteSaved(id) {
  const it = savesCache.find((x) => x.id === id); if (!it) return;
  const name = (it.data && it.data.name) || '未命名劇本';
  if (!confirm('刪除「' + name + '」？所有人都會看不到。')) return;
  try { await api('/api/items/' + id, { method: 'DELETE' }); renderSaves(); }
  catch (e) { document.getElementById('saves-status').textContent = '❌ ' + e.message; }
}

// ---- 漂浮塵粒（與封面一致）----
function startDust() {
  const canvas = document.getElementById('dust'); if (!canvas) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d'); let W, H, motes = [], raf = 0;
  function resize() {
    W = canvas.width = innerWidth; H = canvas.height = innerHeight;
    const n = Math.min(80, Math.floor((W * H) / 28000));
    motes = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 + 0.3, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15, a: Math.random() * 0.4 + 0.05 }));
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const m of motes) {
      m.x += m.vx; m.y += m.vy;
      if (m.x < 0) m.x = W; else if (m.x > W) m.x = 0;
      if (m.y < 0) m.y = H; else if (m.y > H) m.y = 0;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832); ctx.fillStyle = 'rgba(255,255,255,' + m.a + ')'; ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }
  resize(); frame(); window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) frame(); });
}
