const mongoose = require('mongoose')

const quizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        // ของเดิมพิมพ์ผิดเป็น "desciption"
        type: String,
        default: ''
    },
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // ของเดิม ref เป็น 'User' แต่ model ชื่อ 'users' — ตอนนี้ user_opal.js ตั้งชื่อ model เป็น 'User' แล้ว ตรงกัน
        required: true
    },
    questions: [{
        // ของเดิมใช้ชื่อ "question" (เอกพจน์) — เปลี่ยนเป็น "questions" ให้ชัดเจนว่าเป็น array
        questionText: {
            type: String,
            required: true
        },
        questionType: {
            type: String,
            enum: ['quiz', 'true-false'],
            default: 'quiz'
        },
        options: [{
            text: { type: String, required: true },
            isCorrect: { type: Boolean, required: true, default: false }
        }],
        timeLimit: {
            type: Number,
            default: 20
        },
        points: {
            type: Number,
            default: 1000
        }
    }],
    isPublic: {
        type: Boolean,
        default: false
    },
    playCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true })
// timestamps: true = สร้าง createdAt + updatedAt อัตโนมัติ (แทน createAt ที่ต้องทำเอง)

module.exports = mongoose.model('Quiz', quizSchema)
