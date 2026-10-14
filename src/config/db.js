// ===== MONGODB ULANISH =====
// 1) Avval .env dagi MONGO_URI ga ulanishga harakat qiladi.
// 2) Agar Mongo o'rnatilmagan bo'lsa (lokal ishlab chiqish), server/data papkasida
//    saqlanadigan zaxira (embedded) baza ishga tushadi — ma'lumotlar o'chib ketmaydi.
import mongoose from 'mongoose'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function connectDB() {
  const uri = process.env.MONGO_URI
  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 })
      console.log('✅ MongoDB ulandi:', uri)
      return
    } catch {
      console.warn("⚠️  MongoDB topilmadi, lokal zaxira bazaga o'tilmoqda...")
    }
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error("Productionda MONGO_URI to'g'ri ko'rsatilishi shart")
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server')
  const dbPath = path.join(__dirname, '../../data')
  fs.mkdirSync(dbPath, { recursive: true })
  const mem = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: 'wiredTiger', port: 27018 },
  })
  await mongoose.connect(mem.getUri('demomaker'))
  console.log('✅ Lokal zaxira baza ishga tushdi (server/data)')
}
