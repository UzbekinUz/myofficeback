// ===== BARCHA API MARSHRUTLARI =====
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { Admin, Category, Demo, Plan, Inquiry, Setting } from '../models/index.js'
import { requireAuth, signToken } from '../middlewares/auth.js'
import { upload } from '../middlewares/upload.js'
import { crudRouter } from './crud.js'
import { sendTelegram, detectChats, inquiryText } from '../utils/telegram.js'
import { encrypt, decrypt } from '../utils/crypto.js'
import { removeUpload } from '../utils/files.js'

const api = Router()

// Express 4 async xatolarni o'zi ushlamaydi — har bir handler'ni o'raymiz
for (const m of ['get', 'post', 'put', 'delete']) {
  const orig = api[m].bind(api)
  api[m] = (path, ...handlers) =>
    orig(path, ...handlers.map((h) => (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)))
}

// ---------- TEKSHIRUV YORDAMCHILARI ----------
const hasText = (l) => !!l && ['uz', 'en', 'ru'].some((k) => String(l[k] || '').trim())
const isHttp = (u) => !u || /^https?:\/\/[^\s]+$/i.test(u) // "javascript:" kabilar o'tmaydi
const isImage = (u) => !u || /^\/uploads\/[a-f0-9]+\.(png|jpe?g|webp|gif)$/i.test(u) || /^https?:\/\/[^\s]+$/i.test(u)

// ---------- AUTH ----------
// Kirish: username + parol -> JWT token
api.post('/auth/login', async (req, res) => {
  const { username, password } = req.body
  const admin = await Admin.findOne({ username: String(username || '') })
  if (!admin || !(await bcrypt.compare(String(password || ''), admin.password)))
    return res.status(401).json({ message: "Login yoki parol noto'g'ri" })
  res.json({ token: signToken(admin), username: admin.username })
})

// Token hali yaroqlimi (sahifa yangilanganda tekshirish uchun)
api.get('/auth/me', requireAuth, (req, res) => res.json(req.admin))

// Login / parolni almashtirish (joriy parol talab qilinadi)
api.put('/auth/credentials', requireAuth, async (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body
  const admin = await Admin.findById(req.admin.id)
  if (!(await bcrypt.compare(String(currentPassword || ''), admin.password)))
    return res.status(400).json({ message: "Joriy parol noto'g'ri" })
  if (newUsername) admin.username = String(newUsername).trim()
  if (newPassword) {
    if (String(newPassword).length < 8) return res.status(400).json({ message: "Parol kamida 8 belgi bo'lsin" })
    admin.password = await bcrypt.hash(String(newPassword), 10)
  }
  await admin.save()
  res.json({ token: signToken(admin), username: admin.username })
})

// ---------- RASM YUKLASH ----------
api.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Fayl yo'q" })
  res.json({ url: `/uploads/${req.file.filename}` })
})

// ---------- KONTENT (GET ochiq, o'zgartirish faqat admin) ----------
api.use('/categories', crudRouter(Category, {
  sort: { order: 1 },
  validate: (b) => {
    if (!hasText(b.title)) return 'Kategoriya nomi kamida bitta tilda kiritilishi shart'
    if (b.color && !/^#[0-9a-f]{6}$/i.test(b.color)) return "Rang noto'g'ri formatda"
    return null
  },
  // Ichida demo bor kategoriyani o'chirib bo'lmaydi
  beforeDelete: async (doc) => {
    const n = await Demo.countDocuments({ category: doc._id })
    return n ? `Bu kategoriyada ${n} ta demo bor. Avval ularni boshqa kategoriyaga o'tkazing yoki o'chiring` : null
  },
}))

api.use('/demos', crudRouter(Demo, {
  populate: 'category',
  validate: (b) => {
    if (!hasText(b.title)) return 'Demo sarlavhasi kamida bitta tilda kiritilishi shart'
    if (!b.category) return 'Kategoriya tanlanishi shart'
    if (!isHttp(b.url)) return "Demo havolasi http:// yoki https:// bilan boshlanishi kerak"
    if (!isImage(b.image)) return "Rasm manzili noto'g'ri"
    if (b.tags && (!Array.isArray(b.tags) || b.tags.length > 20)) return "Texnologiyalar ro'yxati noto'g'ri (20 tagacha)"
    return null
  },
  afterDelete: (doc) => removeUpload(doc.image),                          // rasm faylini ham tozalaymiz
  afterUpdate: (old, doc) => (old.image !== doc.image ? removeUpload(old.image) : null),
}))

api.use('/plans', crudRouter(Plan, {
  sort: { order: 1 },
  validate: (b) => {
    if (!hasText(b.name)) return 'Tarif nomi kamida bitta tilda kiritilishi shart'
    if (!String(b.price || '').trim()) return 'Narx kiritilishi shart'
    if (String(b.price).length > 40) return 'Narx juda uzun (40 belgigacha)'
    return null
  },
}))

// ---------- MIJOZ SO'ROVLARI ----------
// Ochiq: mijoz forma yuboradi -> bazaga saqlanadi va Telegramga ketadi
api.post('/inquiries', async (req, res) => {
  const { name, contact, message, plan, website, elapsed } = req.body
  // Spam tuzog'i: "website" maydonini odam ko'rmaydi, bot to'ldiradi. Juda tez yuborilgan forma ham bot.
  // Botga xato ko'rsatmaymiz (muvaffaqiyat qaytaramiz), lekin hech narsa saqlanmaydi.
  if (website || (Number(elapsed) >= 0 && Number(elapsed) < 2500)) return res.status(201).json({ ok: true })

  if (!String(name || '').trim() || !String(contact || '').trim())
    return res.status(400).json({ message: 'Ism va aloqa majburiy' })
  const q = await Inquiry.create({
    name: String(name).trim().slice(0, 100),
    contact: String(contact).trim().slice(0, 100),
    message: String(message || '').slice(0, 2000),
    plan: String(plan || '').slice(0, 100),
  })
  const tg = await sendTelegram(inquiryText(q))
  if (tg.ok) { q.telegramSent = true; await q.save() }
  res.status(201).json({ ok: true })
})

// Admin: sahifalangan ro'yxat. ?page=1&limit=20&unread=1
api.get('/inquiries', requireAuth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
  const filter = req.query.unread ? { read: false } : {}
  const [items, total] = await Promise.all([
    Inquiry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Inquiry.countDocuments(filter),
  ])
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
})
// Admin: faqat o'qilmaganlar (alert uchun yengil so'rov, eng ko'pi 20 ta + umumiy son)
api.get('/inquiries/unread', requireAuth, async (_req, res) => {
  const [items, count] = await Promise.all([
    Inquiry.find({ read: false }).sort({ createdAt: -1 }).limit(20),
    Inquiry.countDocuments({ read: false }),
  ])
  res.json({ items, count })
})
api.put('/inquiries/:id', requireAuth, async (req, res) =>
  res.json(await Inquiry.findByIdAndUpdate(req.params.id, { read: !!req.body.read }, { new: true })))
api.delete('/inquiries/:id', requireAuth, async (req, res) => {
  await Inquiry.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

// ---------- SOZLAMALAR ----------
// Ochiq qismi: bot tokeni va chat ID HECH QACHON qaytarilmaydi
api.get('/settings/public', async (_req, res) => {
  const s = (await Setting.findOne({ key: 'main' })) || {}
  res.json({
    contactPhone: s.contactPhone || '',
    contactTelegram: s.contactTelegram || '',
    contactEmail: s.contactEmail || '',
    ownerName: s.ownerName || '',
    about: s.about || {},
    years: s.years || 0,
    faq: s.faq || [],
    process: s.process || [],
    stack: s.stack || [],
  })
})
// Admin: to'liq sozlamalar (token maskalangan holda qaytadi)
api.get('/settings', requireAuth, async (_req, res) => {
  const s = (await Setting.findOne({ key: 'main' })) || new Setting()
  const o = s.toObject()
  const plain = decrypt(o.telegramToken)
  o.telegramTokenSet = !!plain
  o.telegramToken = plain ? '••••' + plain.slice(-6) : ''
  res.json(o)
})
const SETTING_KEYS = ['telegramChatId', 'telegramEnabled', 'contactPhone', 'contactTelegram', 'contactEmail',
  'ownerName', 'about', 'years', 'faq', 'process', 'stack']
api.put('/settings', requireAuth, async (req, res) => {
  const data = Object.fromEntries(Object.entries(req.body).filter(([k]) => SETTING_KEYS.includes(k)))
  // Token faqat yangi (maskalanmagan) qiymat kelganda yangilanadi va shifrlanadi
  const tok = req.body.telegramToken
  if (tok && !String(tok).startsWith('••••')) data.telegramToken = encrypt(String(tok).trim())
  await Setting.findOneAndUpdate({ key: 'main' }, data, { upsert: true, new: true })
  res.json({ ok: true })
})
// Telegram sinov xabari
api.post('/settings/telegram-test', requireAuth, async (_req, res) => {
  const r = await sendTelegram('✅ <b>Test:</b> Telegram bot muvaffaqiyatli ulandi!')
  res.status(r.ok ? 200 : 400).json(r.ok ? { ok: true } : { message: r.reason })
})
// Botga /start yozgan odamning chat ID sini avtomatik topish
api.post('/settings/telegram-detect', requireAuth, async (req, res) => {
  let token = String(req.body.token || '')
  if (!token || token.startsWith('••••')) {
    const s = await Setting.findOne({ key: 'main' })
    token = decrypt(s?.telegramToken)
  }
  if (!token) return res.status(400).json({ message: 'Avval bot tokenini kiriting va saqlang' })
  const r = await detectChats(token)
  if (!r.ok) return res.status(400).json({ message: r.reason })
  if (!r.chats.length) return res.status(404).json({ message: 'Hech narsa topilmadi. Botingizga Telegramda /start yozing va qayta urining' })
  res.json({ chats: r.chats })
})

// ---------- ADMIN STATISTIKA ----------
api.get('/stats', requireAuth, async (_req, res) => {
  const [categories, demos, plans, inquiries, unread] = await Promise.all([
    Category.countDocuments(), Demo.countDocuments(), Plan.countDocuments(),
    Inquiry.countDocuments(), Inquiry.countDocuments({ read: false }),
  ])
  res.json({ categories, demos, plans, inquiries, unread })
})

export default api
