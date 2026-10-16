'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_FILE = path.join(ROOT, 'data', 'transactions.json');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 16 * 1024;
const MAX_AMOUNT_CENTS = 10_000_000_000;

const CATEGORIES = {
  expense: new Set(['餐饮', '交通', '购物', '居家', '医疗', '娱乐', '教育', '其他']),
  income: new Set(['工资', '奖金', '兼职', '理财', '其他'])
};

const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']]
]);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};

let transactions = [];
let mutationQueue = Promise.resolve();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isStoredRecord(record) {
  return record
    && typeof record.id === 'string'
    && (record.type === 'income' || record.type === 'expense')
    && Number.isSafeInteger(record.amountCents)
    && record.amountCents > 0
    && record.amountCents <= MAX_AMOUNT_CENTS
    && typeof record.description === 'string'
    && record.description.length > 0
    && record.description.length <= 80
    && CATEGORIES[record.type].has(record.category)
    && isValidDate(record.date)
    && typeof record.createdAt === 'string';
}

async function loadTransactions() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isStoredRecord)) {
      throw new Error('账目数据格式不正确');
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeTransactions(nextTransactions) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tempFile = DATA_FILE + '.' + process.pid + '.' + randomUUID() + '.tmp';
  const content = JSON.stringify(nextTransactions, null, 2) + '\n';
  try {
    await fs.writeFile(tempFile, content, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tempFile, DATA_FILE);
  } catch (error) {
    await fs.rm(tempFile, { force: true }).catch(() => {});
    throw error;
  }
}

function mutateTransactions(mutator) {
  const operation = mutationQueue.then(async () => {
    const result = mutator(transactions);
    if (result.next !== transactions) {
      await writeTransactions(result.next);
      transactions = result.next;
    }
    return result.value;
  });
  mutationQueue = operation.catch(() => {});
  return operation;
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  response.end(body);
}

function sendEmpty(response, status) {
  response.writeHead(status, SECURITY_HEADERS);
  response.end();
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers['content-length'] || 0);
  if (contentLength > MAX_BODY_BYTES) throw new HttpError(413, '请求内容太大');

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, '请求内容太大');
    chunks.push(chunk);
  }

  if (size === 0) throw new HttpError(400, '请填写账目信息');
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, '请求内容不是有效的 JSON');
  }
}

function validateTransaction(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, '请填写有效的账目信息');
  }
  if (input.type !== 'income' && input.type !== 'expense') {
    throw new HttpError(400, '请选择收入或支出');
  }

  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (!description || description.length > 80) {
    throw new HttpError(400, '用途请填写 1 到 80 个字');
  }
  if (typeof input.category !== 'string' || !CATEGORIES[input.type].has(input.category)) {
    throw new HttpError(400, '请选择有效的分类');
  }
  if (!isValidDate(input.date)) {
    throw new HttpError(400, '请选择有效日期');
  }

  const amount = Number(input.amount);
  const amountCents = Math.round(amount * 100);
  if (
    !Number.isFinite(amount)
    || amount <= 0
    || !Number.isSafeInteger(amountCents)
    || amountCents > MAX_AMOUNT_CENTS
    || Math.abs(amount - amountCents / 100) > 1e-8
  ) {
    throw new HttpError(400, '金额需大于 0，且最多保留两位小数');
  }

  return {
    id: randomUUID(),
    type: input.type,
    amountCents,
    description,
    category: input.category,
    date: input.date,
    createdAt: new Date().toISOString()
  };
}

function sortTransactions(items) {
  return [...items].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

async function serveStatic(pathname, response) {
  const asset = STATIC_FILES.get(pathname);
  if (!asset) {
    sendJson(response, 404, { error: '找不到这个页面' });
    return;
  }

  try {
    const content = await fs.readFile(path.join(PUBLIC_DIR, asset[0]));
    response.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': asset[1],
      'Content-Length': content.length,
      'Cache-Control': 'no-cache'
    });
    response.end(content);
  } catch (error) {
    console.error('读取页面文件失败:', error.message);
    sendJson(response, 500, { error: '页面暂时无法打开' });
  }
}

async function handleRequest(request, response) {
  let url;
  try {
    url = new URL(request.url, 'http://' + (request.headers.host || 'localhost'));
  } catch {
    sendJson(response, 400, { error: '请求地址无效' });
    return;
  }

  if (!url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: '不支持的请求方式' });
      return;
    }
    await serveStatic(url.pathname, response);
    return;
  }

  if (url.pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (url.pathname === '/api/transactions' && request.method === 'GET') {
    sendJson(response, 200, { transactions: sortTransactions(transactions) });
    return;
  }

  if (url.pathname === '/api/transactions' && request.method === 'POST') {
    const input = await readJsonBody(request);
    const record = validateTransaction(input);
    await mutateTransactions((current) => ({ next: [...current, record], value: record }));
    sendJson(response, 201, { transaction: record });
    return;
  }

  const deleteMatch = url.pathname.match(/^\/api\/transactions\/([0-9a-f-]{36})$/i);
  if (deleteMatch && request.method === 'DELETE') {
    const id = deleteMatch[1];
    const removed = await mutateTransactions((current) => {
      const next = current.filter((record) => record.id !== id);
      return { next: next.length === current.length ? current : next, value: next.length !== current.length };
    });
    if (!removed) {
      sendJson(response, 404, { error: '这笔账目已经不存在' });
      return;
    }
    sendEmpty(response, 204);
    return;
  }

  sendJson(response, 404, { error: '找不到这个接口' });
}

async function main() {
  transactions = await loadTransactions();

  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }
      console.error('处理请求失败:', error.message);
      if (!response.headersSent) sendJson(response, 500, { error: '服务器暂时遇到问题，请稍后再试' });
      else response.destroy();
    });
  });

  server.listen(PORT, HOST, () => {
    const address = server.address();
    console.log('拾光账本已启动: http://localhost:' + address.port);
  });
}

main().catch((error) => {
  console.error('账本启动失败:', error.message);
  process.exitCode = 1;
});
