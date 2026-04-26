const Quiz           = require('../Models/quiz')
const { cloudinary } = require('../Config/cloudinary')

exports.listPublicQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ isPublic: true })
            .populate('creatorId', 'username')
            .select('-questions.options.isCorrect -questions.acceptedAnswers')
            .sort({ createdAt: -1 })
        res.json(quizzes)
    } catch (err) {
        console.error(err.stack)
        res.status(500).json({ message: err.message })
    }
}

exports.getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id).populate('creatorId', 'username')
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' })
        res.json(quiz)
    } catch (err) {
        console.error(err.stack)
        res.status(500).json({ message: err.message })
    }
}

exports.getMyQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ creatorId: req.user.id }).sort({ createdAt: -1 })
        res.json(quizzes)
    } catch (err) {
        console.error(err.stack)
        res.status(500).json({ message: err.message })
    }
}

exports.createQuiz = async (req, res) => {
    try {
        console.log('=== CREATE QUIZ ===')
        console.log('body:', req.body)
        console.log('file:', req.file)

        const { title, description, isPublic, category, questions: questionsRaw } = req.body

        if (!title) return res.status(400).json({ message: 'กรุณากรอกชื่อ Quiz' })
        if (!questionsRaw) return res.status(400).json({ message: 'Quiz ต้องมีอย่างน้อย 1 คำถาม' })

        let questions
        try {
            questions = JSON.parse(questionsRaw)
        } catch (parseErr) {
            console.error('JSON parse error:', parseErr.message)
            return res.status(400).json({ message: 'questions ต้องเป็น JSON string ที่ถูกต้อง' })
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: 'Quiz ต้องมีอย่างน้อย 1 คำถาม' })
        }

        const coverImage = req.file
            ? { url: req.file.path, publicId: req.file.filename }
            : { url: null, publicId: null }

        console.log('coverImage:', coverImage)

        const newQuiz = new Quiz({
            title,
            description: description || '',
            coverImage,
            questions,
            isPublic:  isPublic === 'true',
            category:  category || 'General',
            creatorId: req.user.id
        })

        const savedQuiz = await newQuiz.save()
        console.log('Quiz saved:', savedQuiz._id)
        res.status(201).json(savedQuiz)

    } catch (err) {
        console.error('=== CREATE QUIZ ERROR ===')
        console.error('name:', err.name)
        console.error('message:', err.message)
        console.error('stack:', err.stack)
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message })
        }
        res.status(500).json({ message: err.message })
    }
}

exports.updateQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id)
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' })
        if (quiz.creatorId.toString() !== req.user.id) return res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไข Quiz นี้' })

        if (req.body.coverImage && quiz.coverImage?.publicId) {
            await cloudinary.uploader.destroy(quiz.coverImage.publicId)
        }

        const updatedQuiz = await Quiz.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true })
        res.json(updatedQuiz)
    } catch (err) {
        console.error(err.stack)
        res.status(500).json({ message: err.message })
    }
}

exports.deleteQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id)
        if (!quiz) return res.status(404).json({ message: 'Quiz not found' })
        if (quiz.creatorId.toString() !== req.user.id) return res.status(403).json({ message: 'ไม่มีสิทธิ์ลบ Quiz นี้' })

        if (quiz.coverImage?.publicId) await cloudinary.uploader.destroy(quiz.coverImage.publicId)

        for (const q of quiz.questions) {
            if (q.questionImage?.publicId) await cloudinary.uploader.destroy(q.questionImage.publicId)
        }

        await Quiz.findByIdAndDelete(req.params.id)
        res.json({ message: 'ลบ Quiz สำเร็จ' })
    } catch (err) {
        console.error(err.stack)
        res.status(500).json({ message: err.message })
    }
}
