import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import express from 'express';

const app = express();
const port = Number(process.env.API_PORT || 3001);
const isProduction = process.env.NODE_ENV === 'production';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = path.join(projectRoot, 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const database = new Database(path.join(dataDirectory, 'kindred.sqlite'));
database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    value_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE,
    phone TEXT NOT NULL,
    wanted_items TEXT NOT NULL DEFAULT '',
    balance REAL NOT NULL CHECK(balance >= 0),
    spent REAL NOT NULL DEFAULT 0 CHECK(spent >= 0),
    due_on TEXT,
    orders INTEGER NOT NULL DEFAULT 0 CHECK(orders >= 0),
    created_at TEXT NOT NULL,
    UNIQUE(user_id, email)
  );
  CREATE INDEX IF NOT EXISTS customers_user_idx ON customers(user_id, name);
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('Credit issued', 'Payment received')),
    date TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    method TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions(user_id, date DESC);
`);

const scrypt = promisify(crypto.scrypt);
const sessionLifetimeSeconds = 60 * 60 * 24 * 14;
const sessionCookieName = 'kindred_session';
const defaultSettings = {
  storeName: 'The Corner Store',
  email: 'hello@thecornerstore.com',
  currency: 'USD',
  reminderDays: 3,
  overdueReminders: true,
  weeklySummary: true,
  theme: 'light',
  accent: 'violet',
};
const accents = new Set(['violet', 'ocean', 'forest']);
const themes = new Set(['light', 'dark', 'system']);
const currencies = new Set(['USD', 'GBP', 'EUR']);
const signInAttempts = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb', strict: true }));

function publicError(res, status, message) {
  return res.status(status).json({ error: message });
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isMoney(value, allowZero = true) {
  return Number.isFinite(value)
    && value >= (allowZero ? 0 : 0.01)
    && Math.abs(Math.round(value * 100) - value * 100) < 1e-7;
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function getStatus(balance, dueOn) {
  if (balance <= 0) return 'Paid';
  if (dueOn && dueOn < new Date().toISOString().slice(0, 10)) return 'Overdue';
  return 'Due soon';
}

function getSessionToken(req) {
  const cookieHeader = req.headers.cookie || '';
  const entry = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookieName}=`));
  return entry ? decodeURIComponent(entry.slice(sessionCookieName.length + 1)) : '';
}

function cookieOptions(maxAge) {
  return [
    `${sessionCookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    ...(isProduction ? ['Secure'] : []),
    ...(maxAge === undefined ? ['Max-Age=0'] : [`Max-Age=${maxAge}`]),
  ].join('; ');
}

function issueSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds;
  database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(crypto.createHash('sha256').update(token).digest('hex'), userId, expiresAt);
  res.setHeader('Set-Cookie', cookieOptions(sessionLifetimeSeconds).replace(`${sessionCookieName}=`, `${sessionCookieName}=${encodeURIComponent(token)}`));
}

function dateForTransaction() {
  return new Date().toISOString().slice(0, 10);
}

const customerColors = ['lavender', 'peach', 'mint', 'blue', 'pink', 'yellow'];

function getBootstrap(userId) {
  const user = database.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
  if (!user) return null;
  const savedSettings = database.prepare('SELECT value_json FROM settings WHERE user_id = ?').get(userId);
  const settings = {
    ...defaultSettings,
    ...(savedSettings ? JSON.parse(savedSettings.value_json) : {}),
  };
  const customerRows = database.prepare('SELECT * FROM customers WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  const customerIds = new Map(customerRows.map((row, index) => [row.id, index]));
  const customers = customerRows.map((row, index) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    initials: row.name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
    color: customerColors[index % customerColors.length],
    phone: row.phone,
    wantedItems: row.wanted_items,
    balance: row.balance,
    spent: row.spent,
    due: formatDate(row.due_on),
    dueOn: row.due_on || '',
    orders: row.orders,
    status: getStatus(row.balance, row.due_on),
  }));
  const transactions = database.prepare(`
    SELECT t.id, t.type, t.date, t.amount, t.method, c.id AS customer_id,
      c.name AS customer_name, c.email AS customer_email
    FROM transactions t
    JOIN customers c ON c.id = t.customer_id
    WHERE t.user_id = ?
    ORDER BY t.date DESC, t.rowid DESC
  `).all(userId).map((row) => {
    const customerIndex = customerIds.get(row.customer_id) ?? 0;
    return {
      id: row.id,
      customerId: row.customer_id,
      customer: row.customer_name,
      customerEmail: row.customer_email,
      dateISO: row.date,
      initials: row.customer_name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
      color: customerColors[customerIndex % customerColors.length],
      type: row.type,
      date: formatDate(row.date),
      amount: row.amount,
      method: row.method,
    };
  });
  return { user, settings, customers, transactions };
}

function requireSession(req, res, next) {
  const token = getSessionToken(req);
  if (!token) return publicError(res, 401, 'Sign in to continue.');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = database.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(tokenHash);
  if (!session || session.expires_at <= Math.floor(Date.now() / 1000)) {
    if (session) database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    res.setHeader('Set-Cookie', cookieOptions());
    return publicError(res, 401, 'Your session has expired. Sign in again.');
  }
  req.userId = session.user_id;
  next();
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/sign-up', async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (name.length < 2 || name.length > 100) return publicError(res, 400, 'Enter a name between 2 and 100 characters.');
    if (!isValidEmail(email)) return publicError(res, 400, 'Enter a valid email address.');
    if (password.length < 8 || password.length > 128) return publicError(res, 400, 'Password must be between 8 and 128 characters.');

    const salt = crypto.randomBytes(16);
    const passwordHash = await scrypt(password, salt, 64);
    const id = crypto.randomUUID();
    const createAccount = database.transaction(() => {
      database.prepare('INSERT INTO users (id, name, email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, name, email, salt.toString('base64'), passwordHash.toString('base64'), new Date().toISOString());
      database.prepare('INSERT INTO settings (user_id, value_json) VALUES (?, ?)')
        .run(id, JSON.stringify({ ...defaultSettings, email }));
    });
    try {
      createAccount();
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return publicError(res, 409, 'An account with this email already exists.');
      throw error;
    }
    issueSession(res, id);
    res.status(201).json(getBootstrap(id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/sign-in', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!isValidEmail(email) || !password || password.length > 128) return publicError(res, 400, 'Enter a valid email and password.');
    const now = Date.now();
    const attempt = signInAttempts.get(email);
    if (attempt && attempt.until > now && attempt.count >= 10) return publicError(res, 429, 'Too many sign-in attempts. Wait a few minutes and try again.');
    const user = database.prepare('SELECT id, name, email, password_salt, password_hash FROM users WHERE email = ?').get(email);
    const salt = user ? Buffer.from(user.password_salt, 'base64') : Buffer.alloc(16);
    const actualHash = await scrypt(password, salt, 64);
    const expectedHash = user ? Buffer.from(user.password_hash, 'base64') : Buffer.alloc(64);
    const matches = actualHash.length === expectedHash.length && crypto.timingSafeEqual(actualHash, expectedHash);
    if (!user || !matches) {
      const current = attempt && attempt.until > now ? attempt : { count: 0, until: now + 15 * 60 * 1000 };
      current.count += 1;
      signInAttempts.set(email, current);
      return publicError(res, 401, 'Email or password is incorrect.');
    }
    signInAttempts.delete(email);
    issueSession(res, user.id);
    res.json(getBootstrap(user.id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/sign-out', requireSession, (req, res) => {
  const token = getSessionToken(req);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  database.prepare('DELETE FROM sessions WHERE token_hash = ? AND user_id = ?').run(tokenHash, req.userId);
  res.setHeader('Set-Cookie', cookieOptions());
  res.status(204).end();
});

app.get('/api/bootstrap', requireSession, (req, res) => {
  const bootstrap = getBootstrap(req.userId);
  if (!bootstrap) return publicError(res, 401, 'Your account is no longer available.');
  res.json(bootstrap);
});

app.put('/api/profile', requireSession, (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = normalizeEmail(req.body.email);
  if (name.length < 2 || name.length > 100) return publicError(res, 400, 'Enter a name between 2 and 100 characters.');
  if (!isValidEmail(email)) return publicError(res, 400, 'Enter a valid email address.');
  try {
    database.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, req.userId);
    res.json(getBootstrap(req.userId));
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return publicError(res, 409, 'An account with this email already exists.');
    throw error;
  }
});

app.put('/api/settings', requireSession, (req, res) => {
  const { storeName, email, currency, reminderDays, overdueReminders, weeklySummary, theme, accent } = req.body;
  if (typeof storeName !== 'string' || !storeName.trim() || storeName.trim().length > 100) return publicError(res, 400, 'Enter a store name between 1 and 100 characters.');
  if (!isValidEmail(normalizeEmail(email))) return publicError(res, 400, 'Enter a valid store email address.');
  if (!currencies.has(currency) || ![1, 3, 7].includes(reminderDays) || typeof overdueReminders !== 'boolean' || typeof weeklySummary !== 'boolean' || !themes.has(theme) || !accents.has(accent)) {
    return publicError(res, 400, 'One or more store preferences are invalid.');
  }
  const settings = { storeName: storeName.trim(), email: normalizeEmail(email), currency, reminderDays, overdueReminders, weeklySummary, theme, accent };
  database.prepare('INSERT INTO settings (user_id, value_json) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET value_json = excluded.value_json')
    .run(req.userId, JSON.stringify(settings));
  res.json(getBootstrap(req.userId));
});

app.post('/api/customers', requireSession, (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = normalizeEmail(req.body.email);
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  const wantedItems = typeof req.body.wantedItems === 'string' ? req.body.wantedItems.trim() : '';
  const dueOn = req.body.dueOn || null;
  const balance = Number(req.body.balance);
  const orders = Number(req.body.orders);
  if (name.length < 2 || name.length > 100) return publicError(res, 400, 'Enter a customer name between 2 and 100 characters.');
  if (!isValidEmail(email)) return publicError(res, 400, 'Enter a valid customer email address.');
  if (phone.length > 40 || wantedItems.length > 2000) return publicError(res, 400, 'Phone or customer notes are too long.');
  if (!isMoney(balance) || !Number.isSafeInteger(orders) || orders < 0 || orders > 100000000) return publicError(res, 400, 'Opening balance or order count is invalid.');
  if (dueOn !== null && !isValidDate(dueOn)) return publicError(res, 400, 'Choose a valid due date.');
  const customerId = crypto.randomUUID();
  const create = database.transaction(() => {
    database.prepare(`INSERT INTO customers
      (id, user_id, name, email, phone, wanted_items, balance, due_on, orders, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(customerId, req.userId, name, email, phone || '—', wantedItems, balance, dueOn, orders, new Date().toISOString());
    if (balance > 0) {
      database.prepare(`INSERT INTO transactions (id, user_id, customer_id, type, date, amount, method)
        VALUES (?, ?, ?, 'Credit issued', ?, ?, 'Opening balance')`)
        .run(crypto.randomUUID(), req.userId, customerId, dateForTransaction(), balance);
    }
  });
  try {
    create();
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return publicError(res, 409, 'A customer with that email already exists.');
    throw error;
  }
  res.status(201).json(getBootstrap(req.userId));
});

app.delete('/api/customers/:id', requireSession, (req, res) => {
  const result = database.prepare('DELETE FROM customers WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (!result.changes) return publicError(res, 404, 'Customer not found.');
  res.json(getBootstrap(req.userId));
});

app.post('/api/customers/:id/payments', requireSession, (req, res) => {
  const amount = Number(req.body.amount);
  const method = typeof req.body.method === 'string' ? req.body.method.trim() : '';
  const allowedMethods = new Set(['Cash', 'Card', 'Bank transfer', 'Other']);
  if (!isMoney(amount, false) || !allowedMethods.has(method)) return publicError(res, 400, 'Enter a valid payment amount and method.');
  const customer = database.prepare('SELECT * FROM customers WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!customer) return publicError(res, 404, 'Customer not found.');
  if (amount > customer.balance) return publicError(res, 400, 'Payment cannot exceed the customer’s outstanding balance.');
  const record = database.transaction(() => {
    database.prepare('UPDATE customers SET balance = balance - ? WHERE id = ? AND user_id = ?')
      .run(amount, customer.id, req.userId);
    database.prepare(`INSERT INTO transactions (id, user_id, customer_id, type, date, amount, method)
      VALUES (?, ?, ?, 'Payment received', ?, ?, ?)`)
      .run(crypto.randomUUID(), req.userId, customer.id, dateForTransaction(), amount, method);
  });
  record();
  res.status(201).json(getBootstrap(req.userId));
});

if (isProduction) {
  const buildDirectory = path.join(projectRoot, 'dist');
  app.use(express.static(buildDirectory, { index: false }));
  app.get('*', (_req, res, next) => {
    const indexFile = path.join(buildDirectory, 'index.html');
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
    next();
  });
}

app.use('/api', (_req, res) => publicError(res, 404, 'API route not found.'));
app.use((error, _req, res, _next) => {
  console.error('API request failed:', error);
  if (res.headersSent) return;
  if (error instanceof SyntaxError && 'body' in error) return publicError(res, 400, 'Request body must contain valid JSON.');
  publicError(res, 500, 'The server could not complete that request.');
});

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Kindred API listening at http://127.0.0.1:${port}`);
  if (!isProduction) console.log(`SQLite database: ${path.join(dataDirectory, 'kindred.sqlite')}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
