require('dotenv').config()
const express    = require('express')
const http       = require('http')
const { Server } = require('socket.io')
const cors       = require('cors')
const connectDB  = require('./Config/db')
const { setupGameHandler } = require('./Socket/gameHandler')

const app    = express()
const server = http.createServer(app)
const io     = new Server(server, { cors: { origin: '*' } })

app.use(cors({
  origin: '*'
}))
app.use(express.json())

app.use('/api', require('./Routes/auth'))
app.use('/api', require('./Routes/quiz'))

// Global error handler
app.use((err, req, res, next) => {
    console.error('=== GLOBAL ERROR ===')
    console.error('name:', err.name)
    console.error('message:', err.message)
    console.error('stack:', err.stack)
    res.status(err.status || 500).json({ message: err.message })
})

setupGameHandler(io)

const PORT = process.env.PORT || 5000
connectDB().then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`))
})
