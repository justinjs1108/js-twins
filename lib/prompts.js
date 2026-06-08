// ============================================================
//  提示詞引擎  Prompt Engine
//  定義五個步驟各自要叫 AI 做什麼。
//  全程只輸出繁體中文、乾淨排版（用【】當標題、「標籤：內容」分項），
//  嚴禁 Markdown 與雜亂符號，方便閱讀。
// ============================================================

const { FORMATS, STRUCTURES } = require('./structures');

// 共用人設：世界級編劇 / 劇本醫生
const SYSTEM = `你是一位世界級的電影編劇與劇本醫生，熟悉坎城、奧斯卡、金棕櫚等得獎電影的敘事工藝，擅長「高概念」發想：用一句話就能勾住人的前提，同時保有情感與主題深度。

【排版與語言守則（務必嚴格遵守）】
一、全程只用繁體中文，不要出現任何英文（連專業術語也用中文說）。
二、排版要極度乾淨、好閱讀。每個段落的標題一律用全形方括號【】標示，例如【點子一】、【主題】、【第 1 場】、【鏡頭 1】。
三、嚴禁使用任何 Markdown 或雜亂符號：不要出現井號 #、星號 *、雙星號、三個減號、表格的直線符號、大於小於符號等。需要分項時，用「標籤：內容」一行一項，或用「一、二、三」。
四、內容要具體、有畫面、可拍攝，避免空泛形容詞與陳腔濫調。
五、每個角色都要有清楚的慾望、需求與致命缺陷。
六、緊扣使用者選定的類型、片長與結構模板，不要偏離。`;

function fmt(id) {
  const f = FORMATS.find((x) => x.id === id);
  return f ? `${f.name}（${f.length}）— ${f.desc}` : '未指定';
}

function struct(id) {
  return STRUCTURES.find((x) => x.id === id);
}

// 把一個專案的已知資訊整理成上下文（餵給 AI，使用者看不到）
function context(p) {
  const lines = [];
  if (p.title) lines.push(`片名：${p.title}`);
  if (p.format) lines.push(`片長與形式：${fmt(p.format)}`);
  if (p.genres && p.genres.length) lines.push(`類型：${p.genres.join('、')}`);
  if (p.idea) lines.push(`使用者的初始想法：${p.idea}`);
  if (p.logline) lines.push(`已選定的故事前提：${p.logline}`);
  return lines.join('\n');
}

// ---- 步驟 1：發想 Brainstorm ---------------------------------
function brainstorm(p) {
  const user = `目前設定：
${context(p)}

請進行「高概念腦力激盪」，產出 4 個彼此差異明顯的故事點子。每個點子都用下面這個乾淨格式（標題放進【】，其餘用「標籤：內容」）：

【點子一：暫定片名】
一句話前提：（30 字內，要包含主角、目標、阻礙、賭注）
亮點：（為什麼這個點子獨特、有記憶點）
主題：（它真正想說什麼）
主角與缺陷：（主角是誰、他的慾望、他真正需要的、他的致命缺陷）

四個點子（點子一、點子二、點子三、點子四）寫完後，最後加上：

【總結建議】
以你的專業判斷，哪一個最有得獎或賣座潛力，為什麼（兩三句話）。`;
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }];
}

// ---- 步驟 2：結構 Structure ----------------------------------
function structure(p) {
  // 使用「參照電影分析」出來的自訂結構
  if (p.structureId === 'custom' && p.customStructure && p.customStructure.beatsText) {
    const u = `目前設定：
${context(p)}
${p.brainstormResult ? '\n先前的發想內容（請延續使用者選定的方向）：\n' + p.brainstormResult + '\n' : ''}
請參照以下「從使用者提供的電影分析出來的結構」，把這個故事套進它的關鍵節拍：
${p.customStructure.beatsText}

每個節拍用這個格式（節拍名稱放進【】，內容 2 到 4 句、要有畫面與因果）：

【節拍名稱】
（這個節拍發生什麼）

請確保主角的慾望與缺陷在節拍之間有清楚的成長弧線。`;
    return [{ role: 'system', content: SYSTEM }, { role: 'user', content: u }];
  }
  const s = struct(p.structureId);
  const beatList = s
    ? s.beats.map((b, i) => `${i + 1}、${b.name}：${b.desc}`).join('\n')
    : '（未選擇結構，請用三幕劇）';
  const user = `目前設定：
${context(p)}
${p.brainstormResult ? '\n先前的發想內容（請延續使用者在「故事前提」選定的方向）：\n' + p.brainstormResult + '\n' : ''}
請套用結構模板：${s ? s.name : '三幕劇'}
（${s ? s.summary : ''}）

請依下列每一個節拍，為這個故事填入具體內容。每個節拍用這個格式（節拍名稱放進【】，內容 2 到 4 句、要有畫面與因果）：

【節拍名稱】
（這個節拍發生什麼）

節拍清單：
${beatList}

填寫時請確保主角的慾望與缺陷在節拍之間有清楚的成長弧線。`;
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }];
}

// ---- 步驟 3：分場 Scene Breakdown ----------------------------
function scenes(p) {
  const user = `目前設定：
${context(p)}

以下是已確認的結構大綱（請以此為準，不要改動故事走向）：
${p.structureResult || '（尚未產生結構，請依片長合理規劃）'}

請把它展開成「分場大綱」。逐場列出，每一場都用這個格式：

【第 1 場】
地點時間：內景或外景、地點、白天或夜晚
本場目的：這一場推進了什麼（情緒或資訊的轉變）
概要：（兩三句，要有畫面）

場數請符合片長（短片約 8 到 15 場；長片可挑 20 到 30 個代表性場次示意）。`;
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }];
}

// ---- 步驟 4：成稿 Screenplay ---------------------------------
function screenplay(p) {
  const user = `目前設定：
${context(p)}

以下是已確認的分場大綱：
${p.scenesResult || '（尚未產生分場，請依結構合理鋪排）'}

請挑選其中「最關鍵的 2 到 3 場」，寫成正式的電影劇本（純中文、乾淨排版）。每一場都用這個格式：

【場景：內景・地點・夜】
（用一段文字寫動作描述，現在式、精煉、有畫面）
角色名：對白（自然、有潛台詞；必要時用全形括號標表演提示）
角色名：對白

場與場之間空一行。對白要符合角色身份，不要使用任何英文與符號表格。`;
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }];
}

// ---- 步驟 5：分鏡腳本 Shooting Script ------------------------
function shooting(p) {
  const user = `目前設定：
${context(p)}

以下是已寫好的劇本片段：
${p.screenplayResult || '（尚未成稿，請就分場挑一場示範）'}

請把它寫成「電影感分鏡腳本」，嚴格照下面這個版面（純中文、不要 Markdown、不要表格符號）：

先寫三行表頭（用「標籤：內容」）：
標題：中文片名
類型：例如 短片、MV、短劇、長片片段
格式：一句話風格定位，例如 都市懸疑視覺敘事

接著空一行，放一條分隔線（用全形等號，約 24 個）：
════════════════════════

然後依「幕」與「場景」往下寫：
每一幕的標題寫成「第一幕　段落名（時間碼，例如 0:00–0:15）」，不要加方括號。
每個場景的標題用方括號，例如：【場景一：外景／地點 — 黃昏】
場景內容只用這兩種行，各自獨立成行、之間可空行：
（用全形括號寫動作、鏡頭、運鏡、聲音與配樂提示，一行一個動作）
角色名：對白

請涵蓋 2 到 3 個場景，鏡頭與運鏡設計要服務情緒與節奏，讀起來像專業劇本。`;
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }];
}

// ---- 電影結構分析 Analyze Movie ----------------------------
function analyzeMovie(p) {
  const movies = (p.movieInput || '').trim();
  const user = `請分析以下電影的敘事結構（可能不只一部，用頓號或換行分隔）：
${movies || '（未提供電影）'}

如果有多部，請歸納它們共通的結構骨架。用乾淨格式輸出（純中文、用【】當標題，不要 Markdown）：

【整體結構定位】
（一句話說明這是哪一類結構，例如 非線性雙線、英雄旅程變奏、三幕加中點翻轉）

【關鍵節拍拆解】
逐個列出關鍵結構節拍，每個用「節拍名稱：在故事中的位置與作用」一行，約 6 到 10 個。

【可借用的編劇公式】
條列 3 到 5 點，告訴使用者把這個結構套到自己的故事時具體該怎麼做。`;
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }];
}

const BUILDERS = { brainstorm, structure, scenes, screenplay, shooting, analyzeMovie };

function build(stage, project) {
  const fn = BUILDERS[stage];
  if (!fn) throw new Error('未知的步驟 stage: ' + stage);
  return fn(project);
}

// ---- AI 萬用助手 Assist ------------------------------------
function assist({ mode, instruction, currentText, stageLabel, structureBeats }) {
  const base = `以下是使用者目前在「${stageLabel || '劇本'}」步驟的內容：
"""
${currentText || '（目前沒有內容）'}
"""`;
  let task;
  if (mode === 'rewrite') {
    task = `\n\n使用者的指示：${instruction}\n\n請依指示改寫上面的內容，直接輸出改寫後的【完整版本】，保持與原本相同的格式（用【】當標題、純中文、不要 Markdown 符號）。只輸出改寫後的內容本身，不要任何前言或說明。`;
  } else if (mode === 'restructure') {
    task = `\n\n請用以下結構，把上面的故事重新編排，輸出改寫後的完整版本（用【】當標題、純中文、不要 Markdown）：\n${structureBeats || instruction}\n\n只輸出改寫後的內容本身，不要前言。`;
  } else {
    task = `\n\n使用者的問題或要求：${instruction}\n\n請以劇本醫生的角度回答與分析，給出具體、可執行的建議（例如哪裡可加反轉、角色動機是否清楚、節奏與結構的優缺點）。用【】乾淨排版、純中文、不要 Markdown。只給分析與建議，不要把全文改寫貼出來。`;
  }
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: base + task }];
}

module.exports = { build, assist, SYSTEM };
