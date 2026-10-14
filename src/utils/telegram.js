// ===== TELEGRAM BOTGA XABAR YUBORISH =====
// Token (shifrlangan) va chat_id admin paneldan (Setting kolleksiyasi) olinadi.
import { Setting } from '../models/index.js'
import { decrypt } from './crypto.js'

const esc = (s = '') => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))

export async function sendTelegram(text) {
  const s = await Setting.findOne({ key: 'main' })
  const token = decrypt(s?.telegramToken)
  if (!s || !token || !s.telegramChatId) return { ok: false, reason: 'Telegram sozlanmagan' }
  if (s.telegramEnabled === false) return { ok: false, reason: "Telegram o'chirilgan" }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: s.telegramChatId, text, parse_mode: 'HTML' }),
    })
    const data = await r.json()
    return data.ok ? { ok: true } : { ok: false, reason: data.description }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

// Botga yozgan odamlarning chat ID larini topadi (admin Chat ID ni qo'lda qidirmasligi uchun).
// Avval botga /start yozish kerak.
export async function detectChats(token) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates`)
    const data = await r.json()
    if (!data.ok) return { ok: false, reason: data.description }
    const seen = new Map()
    for (const u of data.result || []) {
      const chat = u.message?.chat || u.channel_post?.chat || u.my_chat_member?.chat
      if (chat) seen.set(chat.id, { id: String(chat.id), name: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || String(chat.id) })
    }
    return { ok: true, chats: [...seen.values()] }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

// So'rov uchun chiroyli xabar matni (HTML belgilari xavfsiz qilingan)
export const inquiryText = (q) =>
  `🔔 <b>Yangi so'rov!</b>\n\n👤 <b>Ism:</b> ${esc(q.name)}\n📞 <b>Aloqa:</b> ${esc(q.contact)}\n` +
  (q.plan ? `💎 <b>Tarif:</b> ${esc(q.plan)}\n` : '') +
  (q.message ? `💬 <b>Xabar:</b> ${esc(q.message)}` : '')
