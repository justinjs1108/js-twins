// ============================================================
//  Supabase 資料層 — 雲端資料庫 + 邀請碼登入
//  admin（service_role）：所有讀寫（繞過 RLS）
//  超簡化：沒有 email/OTP，登入只靠「邀請碼」。
// ============================================================
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
const admin = (URL && SERVICE)
  ? createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function configured() { return Boolean(URL && SERVICE); }
const norm = (s) => String(s || '').trim().toUpperCase();

// 產生好認的代碼：K7P-3WA9-XQR
function genCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 拿掉容易混淆的 I/O/0/1
  const pick = (n) => Array.from(crypto.randomBytes(n), (b) => alphabet[b % alphabet.length]).join('');
  return `${pick(3)}-${pick(4)}-${pick(3)}`;
}

// ───────── 邀請碼 ─────────
async function lookupCode(code) {
  if (!code) return null;
  const { data } = await admin.from('invite_codes').select('*').eq('code', norm(code)).maybeSingle();
  if (!data || data.revoked) return null;
  return data;
}
async function isAdminCode(code) {
  const c = await lookupCode(code);
  return Boolean(c && c.is_admin);
}
async function touchCode(code) {
  await admin.from('invite_codes').update({ last_used_at: new Date().toISOString() }).eq('code', norm(code));
}
async function listCodes() {
  const { data, error } = await admin.from('invite_codes').select('code,label,is_admin,created_at,last_used_at,revoked').order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}
async function createCode(label) {
  const l = String(label || '').trim();
  if (!l) throw new Error('請輸入一個名字標籤（例如：給小王）');
  let code;
  // 極小機率碰撞，最多重試 5 次
  for (let i = 0; i < 5; i++) {
    code = genCode();
    const { error } = await admin.from('invite_codes').insert({ code, label: l });
    if (!error) return { code, label: l };
    if (!String(error.message || '').includes('duplicate')) throw error;
  }
  throw new Error('產生代碼失敗，請再試一次');
}
async function revokeCode(code) {
  const { error } = await admin.from('invite_codes').update({ revoked: true }).eq('code', norm(code));
  if (error) throw error;
}
async function deleteCode(code) {
  const { error } = await admin.from('invite_codes').delete().eq('code', norm(code));
  if (error) throw error;
}

// ───────── 共用資料 items（劇本 / Prompt / 筆記）─────────
async function listItems(kind) {
  const { data, error } = await admin.from('items').select('*').eq('kind', kind).order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
async function createItem(kind, dataObj, createdBy) {
  const { data, error } = await admin.from('items').insert({ kind, data: dataObj, created_by: createdBy || null }).select().single();
  if (error) throw error;
  return data;
}
async function updateItem(id, dataObj) {
  const { data, error } = await admin.from('items').update({ data: dataObj, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
async function deleteItem(id) {
  const { error } = await admin.from('items').delete().eq('id', id);
  if (error) throw error;
}

module.exports = {
  configured,
  lookupCode, isAdminCode, touchCode, listCodes, createCode, revokeCode, deleteCode,
  listItems, createItem, updateItem, deleteItem,
};
