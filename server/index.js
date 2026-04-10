import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import nodemailer from 'nodemailer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))
}

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }))

// Email notification endpoint
app.post('/api/notify', async (req, res) => {
  const { to, subject, html } = req.body
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' })
  }

  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS
  if (!user || !pass) {
    // Silently succeed so the app still works without email configured
    return res.json({ ok: true, skipped: true, reason: 'Email not configured' })
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user, pass },
    })
    await transporter.sendMail({ from: `"CC Tracker" <${user}>`, to, subject, html })
    res.json({ ok: true })
  } catch (e) {
    console.error('[email]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// SPA fallback in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  )
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server → http://localhost:${PORT}`))
