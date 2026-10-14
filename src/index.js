// ===== SERVER KIRISH NUQTASI =====
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { connectDB } from './config/db.js'
import { createApp } from './app.js'
import { Admin } from './models/index.js'

const prod = process.env.NODE_ENV === 'production'
const DEFAULT_PASSWORD = 'Admin12345'

// ---- Xavfsizlik tekshiruvi ----
// Productionda zaif/standart sozlamalar bilan server ishga tushmaydi. Developmentda faqat ogohlantiradi.
function checkConfig() {
  const problems = []
  const secret = process.env.JWT_SECRET || ''
  if (secret.length < 32 || secret.startsWith('change-me')) problems.push('JWT_SECRET kamida 32 belgili tasodifiy qiymat bo\'lishi kerak')
  const pass = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD
  if (pass === DEFAULT_PASSWORD || pass.length < 10) problems.push('ADMIN_PASSWORD standart yoki juda qisqa (kamida 10 belgi)')
  if (!problems.length) return
  if (prod) {
    console.error('❌ Xavfsiz bo\'lmagan sozlamalar:\n - ' + problems.join('\n - '))
    process.exit(1)
  }
  console.warn('⚠️  Ogohlantirish (hostingdan oldin tuzating):\n - ' + problems.join('\n - '))
}

async function bootstrap() {
  checkConfig()
  await connectDB()

  const existing = await Admin.findOne()
  if (!existing) {
    // Birinchi ishga tushishda admin avtomatik yaratiladi
    await Admin.create({
      username: process.env.ADMIN_USERNAME || 'admin',
      password: await bcrypt.hash(process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD, 10),
    })
    console.log('👤 Admin yaratildi:', process.env.ADMIN_USERNAME || 'admin')
  } else if (prod && (await bcrypt.compare(DEFAULT_PASSWORD, existing.password))) {
    // Bazada hamon standart parol turibdi — productionda ruxsat yo'q
    console.error('❌ Admin paroli hamon standart. Avval lokalda parolni almashtiring.')
    process.exit(1)
  }

  const port = process.env.PORT || 5000
  createApp().listen(port, () => console.log(`🚀 Server: http://localhost:${port}`))
}

bootstrap().catch((e) => { console.error('❌ Boshlashda xato:', e.message); process.exit(1) })
