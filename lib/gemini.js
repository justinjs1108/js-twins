// ============================================================
//  Gemini 原生 API — 支援 YouTube 影片分析（OpenAI 相容層不支援影片）
//  共用同一把 API 金鑰：process.env.AI_API_KEY
//  模型用 gemini-2.0-flash（明確支援影片＋YouTube URL）
// ============================================================
const API_KEY = process.env.AI_API_KEY || '';
const MODEL = process.env.GEMINI_VIDEO_MODEL || 'gemini-2.0-flash';

function isConfigured() { return Boolean(API_KEY); }

async function analyzeYouTube(url, systemPrompt, userPrompt) {
  if (!isConfigured()) throw new Error('AI 金鑰未設定');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { fileData: { fileUri: url, mimeType: 'video/*' } },
        { text: userPrompt },
      ],
    }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  };
  const res = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}：${detail.slice(0, 400)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
  if (!text) throw new Error('Gemini 沒回傳內容（可能影片無法存取，請確認是公開的 YouTube 連結）');
  return text;
}

module.exports = { isConfigured, analyzeYouTube, MODEL };
