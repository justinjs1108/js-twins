// ============================================================
//  使用者儲存  User Store
//  把註冊的帳號存在 data/users.json。
//  （本機與一般主機都可用；之後要換成雲端資料庫也只需改這個檔。）
// ============================================================

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'users.json');

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(obj) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
}

// 帳號一律轉小寫當 key，避免大小寫混淆
function getUser(username) {
  if (!username) return null;
  return readAll()[username.toLowerCase()] || null;
}

function createUser(username, passwordHash) {
  const all = readAll();
  all[username.toLowerCase()] = {
    username,
    passwordHash,
    createdAt: Date.now(),
  };
  writeAll(all);
}

function countUsers() {
  return Object.keys(readAll()).length;
}

module.exports = { getUser, createUser, countUsers };
