const express = require('express')
const router  = express.Router()
const {
    listPublicQuizzes,
    getQuizById,
    getMyQuizzes,
    createQuiz,
    updateQuiz,
    deleteQuiz,
} = require('../Controllers/quiz')
const auth = require('../Middleware/auth')
const { uploadCover } = require('../Config/cloudinary')

// ── ไม่ต้อง Login ───────────────────────────────────────────
router.get('/quizzes',     listPublicQuizzes)
router.get('/quizzes/:id', getQuizById)

// ── ต้อง Login ──────────────────────────────────────────────
router.get('/my-quizzes',     auth, getMyQuizzes)

// createQuiz รับ form-data → uploadCover.single('cover') คั่นกลาง
// ถ้าไม่มีรูป ก็ไม่ต้องส่ง field cover มา multer จะข้ามไปเอง
router.post('/quizzes',       auth, uploadCover.single('cover'), createQuiz)

router.put('/quizzes/:id',    auth, uploadCover.single('cover'), updateQuiz)
router.delete('/quizzes/:id', auth, deleteQuiz)

module.exports = router
