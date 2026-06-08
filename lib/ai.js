// ============================================================
//  AI 客戶端  AI Client
//  支援「任何 OpenAI 相容 API」。在 .env 設定即可：
//    AI_API_KEY        你的金鑰
//    AI_BASE_URL       端點（預設 https://api.openai.com/v1）
//    AI_MODEL          主要模型
//    AI_FALLBACK_MODEL 備援模型（主模型塞車時自動改用，可留空）
//  若沒設金鑰 → 自動進入「示範模式」，回傳範例內容。
//  內建自動重試：遇到 429/503（太多人用、塞車）會自動重試或改用備援模型。
// ============================================================

const BASE_URL = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL || '';
const API_KEY = process.env.AI_API_KEY || '';

const isConfigured = () => Boolean(API_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 呼叫一次模型
async function callOnce(messages, model) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.9 }),
  });

  // 塞車類錯誤 → 標記為可重試
  if (res.status === 429 || res.status === 503) {
    const e = new Error(`模型忙線（${res.status}）`);
    e.retryable = true;
    throw e;
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`AI 服務回傳錯誤 ${res.status}：${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('AI 沒有回傳內容，請檢查模型名稱與金鑰。');
  return text;
}

async function chat(messages) {
  if (!isConfigured()) return demo(messages);

  // 主模型 + 備援模型依序嘗試，每個各重試 2 次
  const models = [MODEL];
  if (FALLBACK_MODEL && FALLBACK_MODEL !== MODEL) models.push(FALLBACK_MODEL);

  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callOnce(messages, model);
      } catch (e) {
        lastErr = e;
        if (!e.retryable) throw e; // 非塞車錯誤（金鑰錯等）直接拋出
        await sleep(900 * (attempt + 1)); // 等一下再重試
      }
    }
  }
  throw new Error('AI 服務目前太多人使用（已自動重試與備援）。請過幾秒再按一次生成。');
}

// ---- 示範模式：回傳一段固定的中英對照範例 -----------------------
function demo(messages) {
  const userText = messages?.[messages.length - 1]?.content || '';
  const tag = (k) => userText.includes(k);

  let body;
  if (tag('腦力激盪') || tag('故事點子')) {
    body = `### 點子 1 — 最後一通電話 / The Last Call
- **Logline**：一名臨終關懷護理師發現自己能接到病患「死後 24 小時」的來電，必須在電話斷線前完成他們的未了之事。 / A hospice nurse who can receive calls from patients 24 hours after they die must resolve their unfinished business before the line goes dead.
- **The Hook**：把「未了的遺憾」變成一個有倒數計時的超自然設定。
- **Theme**：放下，是為了好好活著。/ Letting go is how we learn to live.
- **Protagonist & Flaw**：阿橙，過度負責、不敢面對自己母親的死。

*（這是「示範模式」的範例。設定好 AI 金鑰後，這裡會換成真正為你的設定量身生成的內容。）*`;
  } else if (tag('結構模板') || tag('節拍')) {
    body = `**第一幕：鋪陳 Setup**
阿橙在安寧病房日復一日地工作，對死亡麻木。/ Orange works the hospice ward, numb to death.

**觸發事件 Inciting Incident**
深夜，她接到一名昨天剛過世病患的來電。/ At midnight, she gets a call from a patient who died yesterday.

*（示範模式範例，設定金鑰後會完整填滿所有節拍。）*`;
  } else if (tag('分場')) {
    body = `**Scene 1** — INT. 安寧病房 – 夜 / INT. HOSPICE WARD – NIGHT
- 本場目的：建立阿橙的麻木與孤獨。
- 概要：阿橙替一位老人闔上眼，面無表情。/ Orange closes an old man's eyes, expressionless.

*（示範模式範例。）*`;
  } else if (tag('分鏡')) {
    body = `| 鏡號 | 景別 | 運鏡 | 畫面內容 | 聲音/對白 | 秒數 |
|---|---|---|---|---|---|
| 1 | 特寫 CU | 固定 | 一支老舊手機在桌上震動 / An old phone buzzes | 嗡嗡聲漸強 | 3s |
| 2 | 近景 MS | 緩推 | 阿橙僵住，盯著螢幕上死者的名字 | （無對白） | 4s |

**導演筆記**：用冷藍色調與淺景深，把觀眾鎖在阿橙的恐懼裡。

*（示範模式範例。）*`;
  } else {
    body = `*（示範模式：尚未設定 AI 金鑰，這是一段範例回應。請參考 README 設定金鑰以啟用真正的生成。）*`;
  }

  return new Promise((resolve) => setTimeout(() => resolve(body), 600));
}

module.exports = { chat, isConfigured, MODEL };
