// ===== YUKLANGAN FAYLNI DISKDAN O'CHIRISH =====
// Demo o'chirilganda yoki rasmi almashtirilganda eski fayl axlat bo'lib qolmasligi uchun.
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads')

export async function removeUpload(url) {
  if (!url || !url.startsWith('/uploads/')) return // tashqi URL — tegmaymiz
  const name = path.basename(url) // "../" kabi yo'l hujumlaridan himoya
  try { await fs.unlink(path.join(dir, name)) } catch { /* fayl allaqachon yo'q */ }
}
