const express = require('express')
const router  = express.Router()
const { register, login, getMe } = require('../Controllers/auth')
const auth = require('../Middleware/auth')

router.post('/register', register)
router.post('/login',    login)
router.get('/me', auth,  getMe)

module.exports = router
