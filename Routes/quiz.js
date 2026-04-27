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

const uploadSafe = (req, res, next) => {
    uploadCover.single('cover')(req, res, (err) => {
        if (err) {
            console.error('Upload error (skipping):', err.message)
            req.file = null
        }
        next()
    })
}

router.post('/quizzes',       auth, createQuiz)
router.put('/quizzes/:id',    auth, uploadSafe, updateQuiz)
router.delete('/quizzes/:id', auth, deleteQuiz)

module.exports = router
