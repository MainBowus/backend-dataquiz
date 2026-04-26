require('dotenv').config()
const path = require('path')

const express = require('express')
const morgan = require('morgan')
const cors = require('cors')

const connectDB = require('./Config/db')
const { setupGameHandler } = require('./Socket/gameHandler')

const { createServer } = require('node:http')
const { Server } = require('socket.io')

const app = express()

// เชื่อมต่อ database
connectDB()

// Middleware พื้นฐาน
app.use(morgan('dev'))
app.use(cors())
app.use(express.json())

// สร้าง HTTP server + Socket.IO
const server = createServer(app)

const io = new Server(server, {
    cors: {
        origin: '*',
        // อนุญาตให้ frontend จากทุก origin เชื่อมต่อ Socket.IO ได้
        // (ตอน production ควรเปลี่ยนเป็น URL ของ frontend จริง)
        methods: ['GET', 'POST']
    }
})

// ตั้งค่า Socket.IO game handler
setupGameHandler(io)

// หน้าแรก
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, './index.html'))
})

// โหลด Routes ทั้งหมด — ใช้เฉพาะไฟล์ _opal
const authRoutes = require('./Routes/auth')
const quizRoutes = require('./Routes/quiz')

app.use('/api', authRoutes)
app.use('/api', quizRoutes)

// เริ่ม server
const PORT = process.env.PORT || 5555

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`API: http://localhost:${PORT}/api`)
    console.log(`Socket.IO: ready`)
})
