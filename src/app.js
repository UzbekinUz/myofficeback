// ===== EXPRESS ILOVASI (listen/ulanishsiz — testlar uchun alohida) =====
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import api from './routes/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createApp() {
  const app = express()

  // Nginx/proxy ortida haqiqiy IP olish uchun (rate-limit to'g'ri ishlashi shart)
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1)

  // Xavfsizlik sarlavhalari + Content-Security-Policy:
  // faqat o'z skriptlarimiz ishlaydi, demo iframe'lari uchun https ruxsat etilgan.
  app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        connectSrc: ["'self'"],
        frameSrc: ['https:', 'http:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  }))
  app.use(cors({ origin: process.env.CLIENT_URL || true }))
  app.use(express.json({ limit: '1mb' }))

  // Yuklangan rasmlar: skript sifatida bajarilmasligi uchun nosniff + sandbox
  app.use('/uploads', (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox")
    next()
  }, express.static(path.join(__dirname, '../uploads')))

  // Brute-force va spamdan himoya
  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }))
  app.use('/api/inquiries', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, skip: (r) => r.method !== 'POST' }))

  app.use('/api', api)

  // SEO: robots.txt va sitemap.xml (domen SITE_URL dan, bo'lmasa so'rovdan olinadi)
  const base = (req) => (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')
  app.get('/robots.txt', (req, res) =>
    res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nAllow: /\nSitemap: ${base(req)}/sitemap.xml\n`))
  app.get('/sitemap.xml', (req, res) =>
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url><loc>${base(req)}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`))

  // Productionda React build'ni ham shu server beradi (client/dist mavjud bo'lsa)
  const dist = path.join(__dirname, '../../client/dist')
  app.use(express.static(dist))
  app.get(/^(?!\/api|\/uploads).*/, (_req, res, next) =>
    res.sendFile(path.join(dist, 'index.html'), (err) => err && next()))

  // Xatolik ushlagich: barcha xatolar JSON ko'rinishida qaytadi
  app.use((err, _req, res, _next) => {
    if (err.code === 'LIMIT_FILE_SIZE') { err.status = 400; err.message = 'Rasm hajmi 5 MB dan oshmasin' }
    if (!err.status || err.status >= 500) console.error(err)
    res.status(err.status || 500).json({ message: err.message || 'Server xatosi' })
  })

  return app
}
