// ===== UMUMIY CRUD YASOVCHI =====
// Kategoriya, Demo, Tarif uchun bir xil kod: GET (hamma uchun), POST/PUT/DELETE (faqat admin).
//
// Sozlamalar (options):
//   validate(body)           -> xato matni yoki null (saqlashdan oldin tekshiradi)
//   beforeDelete(doc)        -> xato matni yoki null (o'chirishga to'sqinlik qilishi mumkin)
//   afterDelete(doc)         -> o'chirilgandan keyin (masalan, rasm faylini tozalash)
//   afterUpdate(old, updated)-> yangilangandan keyin (masalan, eski rasmni tozalash)
import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'

// Express 4 da async xatolar avtomatik ushlanmaydi, shuning uchun o'raymiz
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

const RESERVED = new Set(['_id', '__v', 'createdAt', 'updatedAt'])

export function crudRouter(Model, { populate, sort = { order: 1, createdAt: -1 }, validate, beforeDelete, afterDelete, afterUpdate } = {}) {
  const r = Router()
  const allowed = Object.keys(Model.schema.paths).filter((p) => !RESERVED.has(p) && !p.includes('.'))
  // Faqat sxemada bor maydonlarni qoldiramiz (mass-assignment himoyasi).
  // Ko'p tilli obyekt maydonlari (title.uz) ham "title" sifatida o'tadi.
  const roots = new Set([...allowed, ...Object.keys(Model.schema.paths).map((p) => p.split('.')[0]).filter((p) => !RESERVED.has(p))])
  const clean = (body) => Object.fromEntries(Object.entries(body || {}).filter(([k]) => roots.has(k)))

  // Barcha yozuvlar (ochiq)
  r.get('/', wrap(async (_req, res) => {
    let q = Model.find().sort(sort)
    if (populate) q = q.populate(populate)
    res.json(await q)
  }))

  // Yaratish (admin)
  r.post('/', requireAuth, wrap(async (req, res) => {
    const body = clean(req.body)
    const err = validate?.(body)
    if (err) return res.status(400).json({ message: err })
    res.status(201).json(await Model.create(body))
  }))

  // Tahrirlash (admin)
  r.put('/:id', requireAuth, wrap(async (req, res) => {
    const body = clean(req.body)
    const err = validate?.(body)
    if (err) return res.status(400).json({ message: err })
    const old = await Model.findById(req.params.id)
    if (!old) return res.status(404).json({ message: 'Topilmadi' })
    const doc = await Model.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true })
    await afterUpdate?.(old, doc)
    res.json(doc)
  }))

  // O'chirish (admin)
  r.delete('/:id', requireAuth, wrap(async (req, res) => {
    const doc = await Model.findById(req.params.id)
    if (!doc) return res.json({ ok: true })
    const err = await beforeDelete?.(doc)
    if (err) return res.status(409).json({ message: err })
    await doc.deleteOne()
    await afterDelete?.(doc)
    res.json({ ok: true })
  }))

  return r
}
