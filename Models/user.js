const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    }
}, { timestamps: true })
// timestamps: true = สร้าง createdAt และ updatedAt อัตโนมัติ
// (ของเดิมใช้ timeseries ซึ่งเป็นคนละอย่างกัน — timeseries ใช้สำหรับข้อมูลแบบ time-series collection)

module.exports = mongoose.model('User', UserSchema)
