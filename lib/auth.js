// ============================================================
//  登入驗證  Auth
//  用 Node 內建 crypto：
//   - scrypt 雜湊密碼（不存明文）
//   - HMAC 簽章的 cookie 當登入憑證（不需額外的 session 儲存）
// ============================================================

const crypto = require('crypto');

const SECRET = process.env.AUTH_SECRET || 'dev-insecure-secret-please-change';
const COOKIE = 'ss_auth';

// ---- 密碼雜湊 ----
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- 簽章 cookie（無狀態登入憑證）----
function sign(username) {
  const payload = Buffer.from(JSON.stringify({ u: username, t: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).u;
  } catch {
    return null;
  }
}

// ---- 從請求讀出目前登入者 ----
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function currentUser(req) {
  return verifyToken(parseCookies(req)[COOKIE]);
}

function setAuthCookie(res, username, remember) {
  const opts = { httpOnly: true, sameSite: 'lax' };
  // 勾「記住我」→ 一年的持久 cookie；不勾 → session cookie（關閉瀏覽器即登出）
  if (remember) opts.maxAge = 365 * 24 * 60 * 60 * 1000;
  res.cookie(COOKIE, sign(username), opts);
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE);
}

// ---- 中介層：擋住未登入者 ----
function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: '請先登入再使用。' });
  req.user = user;
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  currentUser,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
};
