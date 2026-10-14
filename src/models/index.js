// ===== BARCHA MODELLAR (MongoDB kolleksiyalari) =====
import mongoose from 'mongoose'
const { Schema, model } = mongoose

// Ko'p tilli matn: { uz, en, ru }
const L = { uz: { type: String, default: '' }, en: { type: String, default: '' }, ru: { type: String, default: '' } }

// Admin foydalanuvchi (parol bcrypt bilan xeshlangan holda saqlanadi)
export const Admin = model('Admin', new Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
}, { timestamps: true }))

// Kategoriya ("xona") — masalan: CRM, Web-sayt, Bot
export const Category = model('Category', new Schema({
  title: L,
  description: L,
  icon: { type: String, default: 'Rocket' }, // Lucide ikonka nomi (masalan Globe, Bot)
  color: { type: String, default: '#22d3ee' },  // neon rangi
  order: { type: Number, default: 0 },
}, { timestamps: true }))

// Demo — yaratilgan ish namunasi
export const Demo = model('Demo', new Schema({
  title: L,
  description: L,
  image: { type: String, default: '' }, // /uploads/... yoki tashqi URL
  url: { type: String, default: '' },   // demo havolasi
  tags: [String],                        // texnologiyalar
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  featured: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { timestamps: true }))

// Tarif (narx paketi)
export const Plan = model('Plan', new Schema({
  name: L,
  price: { type: String, required: true }, // masalan "5 000 000" yoki "$300"
  period: L,                                // masalan "bir martalik"
  features: { uz: [String], en: [String], ru: [String] },
  highlighted: { type: Boolean, default: false }, // "Mashhur" belgisi
  order: { type: Number, default: 0 },
}, { timestamps: true }))

// Mijoz so'rovi (aloqa formasidan)
export const Inquiry = model('Inquiry', new Schema({
  name: { type: String, required: true, trim: true },
  contact: { type: String, required: true, trim: true }, // telefon yoki telegram
  message: { type: String, default: '' },
  plan: { type: String, default: '' },
  read: { type: Boolean, default: false },
  telegramSent: { type: Boolean, default: false },
}, { timestamps: true }))

// Sozlamalar (bitta hujjat): Telegram bot va aloqa ma'lumotlari
export const Setting = model('Setting', new Schema({
  key: { type: String, default: 'main', unique: true },
  telegramToken: { type: String, default: '' },
  telegramChatId: { type: String, default: '' },
  telegramEnabled: { type: Boolean, default: true },
  contactPhone: { type: String, default: '' },
  contactTelegram: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  // Profil ("Men haqimda" bo'limi va statistika uchun haqiqiy qiymatlar)
  ownerName: { type: String, default: '' },
  about: L,
  years: { type: Number, default: 0 },
  // Admin paneldan tahrirlanadigan kontent. Bo'sh bo'lsa saytdagi standart matnlar ko'rsatiladi
  faq: [{ _id: false, q: L, a: L }],
  process: [{ _id: false, title: L, text: L }],
  stack: [{ _id: false, group: String, items: [String] }],
}, { timestamps: true }))
