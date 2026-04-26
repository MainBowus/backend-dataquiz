const express = require('express')
const router = express.Router()
const { register, login, getMe } = require('../Controllers/auth')
const auth = require('../Middleware/auth')

// ไม่ต้อง login
router.post('/register', register)     // สมัครสมาชิก
router.post('/login', login)           // เข้าสู่ระบบ

// ต้อง login (มี auth middleware คั่น)
router.get('/me', auth, getMe)         // ดูข้อมูลตัวเอง

module.exports = router
