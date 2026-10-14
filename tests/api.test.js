// ===== API TESTLARI =====
// Ishga tushirish: npm test   (alohida "demomaker_test" bazasidan foydalanadi, asosiy bazaga tegmaydi)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456'
process.env.ENCRYPTION_KEY = 'test-encryption-key'

const { createApp } = await import('../src/app.js')
const { Admin, Category, Demo, Inquiry, Setting } = await import('../src/models/index.js')

const MONGO = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/demomaker_test'
let server, base, token
const realFetch = globalThis.fetch
const telegramCalls = []

const call = (path, { method = 'GET', body, auth = true, headers = {} } = {}) =>
  realFetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })

before(async () => {
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 4000 })
  await mongoose.connection.dropDatabase()
  await Admin.create({ username: 'tester', password: await bcrypt.hash('StrongPass123', 10) })
  await new Promise((r) => { server = createApp().listen(0, r) })
  base = `http://127.0.0.1:${server.address().port}`
  // Telegram so'rovlarini ushlab olamiz (haqiqiy tarmoqqa chiqmaydi)
  globalThis.fetch = (url, opts) => {
    if (String(url).startsWith('https://api.telegram.org')) {
      telegramCalls.push({ url: String(url), body: JSON.parse(opts.body) })
      return Promise.resolve({ json: async () => ({ ok: true }) })
    }
    return realFetch(url, opts)
  }
})

after(async () => {
  globalThis.fetch = realFetch
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
  server.close()
})

test('noto\'g\'ri parol bilan kirib bo\'lmaydi', async () => {
  const r = await call('/api/auth/login', { method: 'POST', auth: false, body: { username: 'tester', password: 'x' } })
  assert.equal(r.status, 401)
})

test('to\'g\'ri parol bilan token olinadi', async () => {
  const r = await call('/api/auth/login', { method: 'POST', auth: false, body: { username: 'tester', password: 'StrongPass123' } })
  assert.equal(r.status, 200)
  token = (await r.json()).token
  assert.ok(token)
})

test('himoyalangan marshrut tokensiz 401 qaytaradi', async () => {
  assert.equal((await call('/api/stats', { auth: false })).status, 401)
  assert.equal((await call('/api/inquiries', { auth: false })).status, 401)
  assert.equal((await call('/api/settings', { auth: false })).status, 401)
})

test('kategoriya nomisiz saqlanmaydi', async () => {
  const r = await call('/api/categories', { method: 'POST', body: { title: { uz: '  ' } } })
  assert.equal(r.status, 400)
})

test('demo: javascript: havola va kategoriyasiz demo rad etiladi', async () => {
  const cat = await (await call('/api/categories', { method: 'POST', body: { title: { uz: 'CRM' } } })).json()
  const bad = await call('/api/demos', { method: 'POST', body: { title: { uz: 'X' }, category: cat._id, url: 'javascript:alert(1)' } })
  assert.equal(bad.status, 400)
  const noCat = await call('/api/demos', { method: 'POST', body: { title: { uz: 'X' } } })
  assert.equal(noCat.status, 400)
})

test('ichida demo bor kategoriyani o\'chirib bo\'lmaydi, demo o\'chgach bo\'ladi', async () => {
  const cat = await Category.findOne()
  const demo = await (await call('/api/demos', {
    method: 'POST', body: { title: { uz: 'Demo' }, category: String(cat._id), url: 'https://example.com' },
  })).json()
  assert.equal((await call(`/api/categories/${cat._id}`, { method: 'DELETE' })).status, 409)
  assert.equal((await call(`/api/demos/${demo._id}`, { method: 'DELETE' })).status, 200)
  assert.equal((await call(`/api/categories/${cat._id}`, { method: 'DELETE' })).status, 200)
  assert.equal(await Demo.countDocuments(), 0)
})

test('tarif narxsiz saqlanmaydi', async () => {
  const r = await call('/api/plans', { method: 'POST', body: { name: { uz: 'Pro' }, price: '  ' } })
  assert.equal(r.status, 400)
})

test('SVG rasm yuklab bo\'lmaydi', async () => {
  const fd = new FormData()
  fd.append('file', new Blob(['<svg onload="alert(1)"/>'], { type: 'image/svg+xml' }), 'x.svg')
  const r = await realFetch(base + '/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
  assert.equal(r.status, 400)
})

test('forma tuzog\'i (honeypot) va juda tez yuborilgan so\'rov saqlanmaydi', async () => {
  const bot = await call('/api/inquiries', { method: 'POST', auth: false, body: { name: 'Bot', contact: '1', website: 'http://spam', elapsed: 9000 } })
  assert.equal(bot.status, 201)
  const fast = await call('/api/inquiries', { method: 'POST', auth: false, body: { name: 'Fast', contact: '1', elapsed: 200 } })
  assert.equal(fast.status, 201)
  assert.equal(await Inquiry.countDocuments(), 0)
})

test('haqiqiy so\'rov saqlanadi va Telegramga to\'g\'ri ma\'lumot bilan ketadi, token shifrlangan', async () => {
  const put = await call('/api/settings', { method: 'PUT', body: { telegramToken: '123456:SECRET_TOKEN_ABC', telegramChatId: '777', telegramEnabled: true } })
  assert.equal(put.status, 200)

  // Bazada token ochiq matn emas
  const stored = await Setting.findOne({ key: 'main' })
  assert.ok(stored.telegramToken.startsWith('enc:'))
  assert.ok(!stored.telegramToken.includes('SECRET_TOKEN'))

  // Admin ko'rinishida faqat maska
  const adminView = await (await call('/api/settings')).json()
  assert.equal(adminView.telegramTokenSet, true)
  assert.ok(!adminView.telegramToken.includes('123456'))

  // Ochiq API tokenni umuman bermaydi
  const pub = JSON.stringify(await (await call('/api/settings/public', { auth: false })).json())
  assert.ok(!pub.includes('SECRET_TOKEN') && !pub.includes('telegramToken') && !pub.includes('777'))

  const r = await call('/api/inquiries', { method: 'POST', auth: false, body: { name: 'Ali', contact: '+998901112233', message: 'Salom <b>', plan: 'Biznes', elapsed: 8000 } })
  assert.equal(r.status, 201)

  const q = await Inquiry.findOne()
  assert.equal(q.name, 'Ali')
  assert.equal(q.telegramSent, true)
  assert.equal(telegramCalls.length, 1)
  assert.ok(telegramCalls[0].url.includes('/bot123456:SECRET_TOKEN_ABC/sendMessage'))
  assert.equal(telegramCalls[0].body.chat_id, '777')
  assert.ok(telegramCalls[0].body.text.includes('Ali'))
  assert.ok(telegramCalls[0].body.text.includes('&lt;b&gt;')) // HTML belgilari xavfsiz qilingan
})

test('so\'rovlar sahifalanadi va o\'qilmagan ro\'yxat ishlaydi', async () => {
  for (let i = 0; i < 25; i++) await Inquiry.create({ name: `U${i}`, contact: '1' })
  const p1 = await (await call('/api/inquiries?page=1&limit=10')).json()
  assert.equal(p1.items.length, 10)
  assert.equal(p1.total, 26)
  assert.equal(p1.pages, 3)
  const unread = await (await call('/api/inquiries/unread')).json()
  assert.equal(unread.count, 26)
  assert.equal(unread.items.length, 20)
})

test('sozlamalarga ruxsat etilmagan maydon yozib bo\'lmaydi', async () => {
  await call('/api/settings', { method: 'PUT', body: { key: 'hacked', contactPhone: '+998' } })
  const s = await Setting.findOne({ key: 'main' })
  assert.equal(s.contactPhone, '+998')
  assert.equal(await Setting.countDocuments({ key: 'hacked' }), 0)
})

test('robots.txt va sitemap.xml beriladi', async () => {
  const robots = await (await call('/robots.txt', { auth: false })).text()
  assert.ok(robots.includes('Disallow: /admin'))
  const sm = await (await call('/sitemap.xml', { auth: false })).text()
  assert.ok(sm.includes('<urlset'))
})
