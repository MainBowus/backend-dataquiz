const express = require('express')
const router = express.Router()
const {
    listPublicQuizzes,
    getQuizById,
    getMyQuizzes,
    createQuiz,
    updateQuiz,
    deleteQuiz
} = require('../Controllers/quiz')
const auth = require('../Middleware/auth')

// ไม่ต้อง login — ใครก็ดูได้
router.get('/quizzes', listPublicQuizzes)          // ดู quiz public ทั้งหมด
router.get('/quizzes/:id', getQuizById)            // ดู quiz ตาม ID

// ต้อง login
router.get('/my-quizzes', auth, getMyQuizzes)      // ดู quiz ของตัวเอง
router.post('/quizzes', auth, createQuiz)          // สร้าง quiz
router.put('/quizzes/:id', auth, updateQuiz)       // แก้ไข quiz (ต้องเป็นเจ้าของ)
router.delete('/quizzes/:id', auth, deleteQuiz)    // ลบ quiz (ต้องเป็นเจ้าของ)

module.exports = router
