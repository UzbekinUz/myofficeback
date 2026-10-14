// ===== NAMUNA MA'LUMOTLAR =====
// Ishga tushirish: npm run seed
// DIQQAT: bazada ma'lumot bo'lsa, tasodifan o'chib ketmasligi uchun to'xtaydi.
// Rostdan ham hammasini tozalab, namunalarni yuklash uchun: npm run seed -- --force
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { Category, Demo, Plan } from '../models/index.js'

await connectDB()

const existing = (await Category.countDocuments()) + (await Demo.countDocuments()) + (await Plan.countDocuments())
if (existing > 0 && !process.argv.includes('--force')) {
  console.log(`⛔ Bazada ${existing} ta yozuv bor. Hech narsa o'zgartirilmadi.`)
  console.log('   Hammasini o\'chirib, namunalarni yuklash uchun:  npm run seed -- --force')
  await mongoose.disconnect()
  process.exit(0)
}
await Promise.all([Category.deleteMany(), Demo.deleteMany(), Plan.deleteMany()])

const t = (uz, en, ru) => ({ uz, en, ru })

const [crm, web, bot] = await Category.create([
  { title: t('CRM tizimlar', 'CRM Systems', 'CRM системы'), icon: 'BarChart3', color: '#22d3ee', order: 1,
    description: t("Biznesni to'liq avtomatlashtiruvchi CRM", 'CRM that fully automates your business', 'CRM для полной автоматизации бизнеса') },
  { title: t('Web-saytlar', 'Websites', 'Веб-сайты'), icon: 'Globe', color: '#a855f7', order: 2,
    description: t('Zamonaviy va tezkor saytlar', 'Modern and fast websites', 'Современные и быстрые сайты') },
  { title: t('Telegram botlar', 'Telegram Bots', 'Telegram боты'), icon: 'Bot', color: '#f472b6', order: 3,
    description: t("Savdo va xizmat uchun botlar", 'Bots for sales and service', 'Боты для продаж и сервиса') },
])

await Demo.create([
  { category: crm._id, featured: true, tags: ['React', 'Node', 'MongoDB'], url: 'https://example.com',
    title: t('Savdo CRM', 'Sales CRM', 'CRM для продаж'),
    description: t('Mijozlar, buyurtmalar va hisobotlar bir joyda', 'Clients, orders and reports in one place', 'Клиенты, заказы и отчёты в одном месте') },
  { category: web._id, featured: true, tags: ['React', 'Tailwind'], url: 'https://example.com',
    title: t('Korporativ sayt', 'Corporate site', 'Корпоративный сайт'),
    description: t('Kompaniya uchun zamonaviy vizitka', 'Modern business card site', 'Современный сайт-визитка') },
  { category: bot._id, tags: ['Node', 'Telegram API'], url: 'https://example.com',
    title: t("Do'kon boti", 'Shop bot', 'Бот-магазин'),
    description: t("Telegram orqali buyurtma qabul qilish", 'Accept orders via Telegram', 'Приём заказов через Telegram') },
])

await Plan.create([
  { order: 1, price: '1 500 000', name: t("Boshlang'ich", 'Starter', 'Старт'), period: t('bir martalik', 'one-time', 'разово'),
    features: { uz: ['Landing sahifa', 'Mobil moslashuv', 'Aloqa formasi'], en: ['Landing page', 'Responsive', 'Contact form'], ru: ['Лендинг', 'Адаптивность', 'Форма связи'] } },
  { order: 2, price: '5 000 000', highlighted: true, name: t('Biznes', 'Business', 'Бизнес'), period: t('bir martalik', 'one-time', 'разово'),
    features: { uz: ['Admin panel', "Ma'lumotlar bazasi", 'Telegram integratsiya', "3 oy qo'llab-quvvatlash"], en: ['Admin panel', 'Database', 'Telegram integration', '3 months support'], ru: ['Админ-панель', 'База данных', 'Интеграция Telegram', 'Поддержка 3 месяца'] } },
  { order: 3, price: '12 000 000', name: t('Premium CRM', 'Premium CRM', 'Премиум CRM'), period: t('bir martalik', 'one-time', 'разово'),
    features: { uz: ["To'liq CRM", 'Rollar va hisobotlar', 'API integratsiyalar', "12 oy qo'llab-quvvatlash"], en: ['Full CRM', 'Roles & reports', 'API integrations', '12 months support'], ru: ['Полная CRM', 'Роли и отчёты', 'API-интеграции', 'Поддержка 12 месяцев'] } },
])

console.log('✅ Namunalar yuklandi')
await mongoose.disconnect()
process.exit(0)
