const mongoose = require('mongoose')

const optionSchema = new mongoose.Schema({
    text:      { type: String, required: true },
    isCorrect: { type: Boolean, required: true, default: false }
}, { _id: false })

const questionSchema = new mongoose.Schema({
    questionText: { type: String, required: true, trim: true },

    questionImage: {
        url:      { type: String, default: null },
        publicId: { type: String, default: null }
    },

    questionType: {
        type: String,
        enum: ['multiple-choice', 'open-ended'],
        required: true,
        default: 'multiple-choice'
    },

    // ตัวเลือก (เฉพาะ multiple-choice)
    options: {
        type: [optionSchema],
        default: undefined,
        validate: {
            validator: function (val) {
                if (this.questionType === 'multiple-choice') {
                    return val && val.length >= 2 && val.some(o => o.isCorrect)
                }
                return true
            },
            message: 'Multiple choice ต้องมีอย่างน้อย 2 ตัวเลือก และมี 1 ตัวเลือกที่ถูก'
        }
    },

    // คำตอบที่ยอมรับได้ (เฉพาะ open-ended) เช่น ['กรุงเทพ', 'Bangkok', 'BKK']
    acceptedAnswers: {
        type: [String],
        default: undefined
    },

    timeLimit: { type: Number, default: 20, min: 5, max: 300 },
    points:    { type: Number, default: 1000, min: 0 }
}, { _id: true })

const quizSchema = new mongoose.Schema({
    title:       { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },

    coverImage: {
        url:      { type: String, default: null },
        publicId: { type: String, default: null }
    },

    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    questions: {
        type: [questionSchema],
        validate: {
            validator: val => val && val.length >= 1,
            message: 'Quiz ต้องมีอย่างน้อย 1 คำถาม'
        }
    },

    isPublic:  { type: Boolean, default: false },
    playCount: { type: Number, default: 0 },
    category:  { type: String, default: 'General' }

}, { timestamps: true })

module.exports = mongoose.model('Quiz', quizSchema)
