// ===== RASM YUKLASH (multer) =====
// Xavfsizlik: SVG ruxsat etilmaydi (ichiga skript yashirish mumkin). Kengaytma mimetype'dan olinadi,
// foydalanuvchi bergan fayl nomiga ishonilmaydi.
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads')
fs.mkdirSync(dir, { recursive: true })

const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' }

export const upload = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + EXT[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (EXT[file.mimetype]) return cb(null, true)
    const err = new Error('Faqat PNG, JPG, WEBP yoki GIF rasm yuklash mumkin')
    err.status = 400
    cb(err)
  },
})
