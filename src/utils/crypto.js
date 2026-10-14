// ===== MAXFIY MA'LUMOTNI SHIFRLASH (AES-256-GCM) =====
// Telegram bot tokeni bazada ochiq matn emas, shifrlangan ("enc:..." bilan boshlanadigan) holda saqlanadi.
// Kalit: ENCRYPTION_KEY (bo'lmasa JWT_SECRET). Kalit o'zgarsa, token qayta kiritilishi kerak.
import crypto from 'crypto'

const key = () =>
  crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || '').digest()

export function encrypt(text) {
  if (!text) return ''
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()])
  return 'enc:' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64')
}

export function decrypt(value) {
  if (!value) return ''
  if (!value.startsWith('enc:')) return value // eski (shifrlanmagan) qiymat
  try {
    const b = Buffer.from(value.slice(4), 'base64')
    const d = crypto.createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12))
    d.setAuthTag(b.subarray(12, 28))
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')
  } catch {
    return '' // kalit almashgan yoki ma'lumot buzilgan
  }
}
