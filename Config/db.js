require('dotenv').config()
const mongoose = require('mongoose')
const dns = require('node:dns')

// บังคับให้ Node.js ใช้ Google DNS (แก้ปัญหา DNS หา MongoDB Atlas ไม่เจอ)
dns.setServers(['8.8.8.8', '8.8.4.4'])

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
        })
        console.log('DB is connected')
    } catch (err) {
        console.log(err)
    }
}
module.exports = connectDB