const jwt = require('jsonwebtoken')

// Middleware ตรวจสอบ JWT Token
// ทำงานเหมือน "รปภ." — ตรวจบัตรผ่าน (token) ก่อนปล่อยเข้า
// ใช้วิธี: ใส่ไว้หน้า route ที่ต้องการป้องกัน เช่น router.post('/createquiz', auth, createQuiz)

const auth = (req, res, next) => {
    try {
        // ดึง token จาก header "Authorization: Bearer <token>"
        const authHeader = req.headers['authorization']

        if (!authHeader) {
            return res.status(401).json({ message: 'No token, access denied' })
        }

        // แยกเอาเฉพาะ token (ตัด "Bearer " ออก)
        const token = authHeader.split(' ')[1]

        if (!token) {
            return res.status(401).json({ message: 'Token format invalid' })
        }

        // ตรวจสอบว่า token ถูกต้องและยังไม่หมดอายุ
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // แนบข้อมูล user เข้าไปใน req เพื่อให้ controller ใช้ต่อได้
        req.user = decoded.user

        // ผ่านได้ → ไป controller ต่อ
        next()
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired, please login again' })
        }
        return res.status(401).json({ message: 'Token is not valid' })
    }
}

module.exports = auth
