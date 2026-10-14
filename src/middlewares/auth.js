// ===== JWT AUTENTIFIKATSIYA MIDDLEWARE =====
// Himoyalangan marshrutlarga qo'yiladi. Mijoz sarlavha yuboradi: Authorization: Bearer <token>
import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Token topilmadi' })
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET) // { id, username }
    next()
  } catch {
    res.status(401).json({ message: 'Token yaroqsiz yoki muddati tugagan' })
  }
}

export const signToken = (admin) =>
  jwt.sign({ id: admin._id, username: admin.username }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '7d',
  })
