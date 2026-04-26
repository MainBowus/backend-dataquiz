const User = require('../Models/user')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

// =====================
// สมัครสมาชิก
// =====================
exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body

        // ตรวจว่ากรอกครบไหม
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' })
        }

        // ตรวจว่ามี username นี้แล้วหรือยัง
        const existingUser = await User.findOne({ username })
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' })
        }

        // เข้ารหัสรหัสผ่าน (hash) — เก็บรหัสผ่านจริงไม่ปลอดภัย
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        // สร้าง user ใหม่
        const user = new User({
            username,
            email: email || '',
            password: hashedPassword
        })

        await user.save()

        res.status(201).json({ message: 'Register success' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// =====================
// เข้าสู่ระบบ
// =====================
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' })
        }

        // หา user จากชื่อ
        // (ของเดิมใช้ findOneAndUpdate ซึ่งผิด — ควรใช้ findOne เฉยๆ เพราะแค่หา ไม่ได้แก้อะไร)
        const user = await User.findOne({ username })

        if (!user) {
            return res.status(400).json({ message: 'Username not found' })
        }

        // เทียบรหัสผ่าน
        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid password' })
        }

        // สร้าง JWT token — ใส่ข้อมูล user เข้าไปใน token
        const payload = {
            user: {
                id: user._id,
                username: user.username
            }
        }

        // ใช้ JWT_SECRET จาก .env (ของเดิม hardcode เป็น 'jwtsecret' ซึ่งไม่ปลอดภัย)
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }, (err, token) => {
            if (err) throw err

            res.json({
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email
                }
            })
        })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// =====================
// ดูข้อมูลตัวเอง (ต้อง login แล้ว)
// =====================
exports.getMe = async (req, res) => {
    try {
        // req.user มาจาก auth middleware (ตรวจ token แล้วแนบข้อมูลมาให้)
        const user = await User.findById(req.user.id).select('-password')
        // .select('-password') = ดึงทุกอย่างยกเว้นรหัสผ่าน

        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        res.json(user)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}
