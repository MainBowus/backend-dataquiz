const Quiz = require('../Models/quiz')

// =====================
// ดึง quiz ทั้งหมดที่เป็น public
// =====================
exports.listPublicQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ isPublic: true })
            .populate('creatorId', 'username')
            // populate = ดึงข้อมูล user ที่สร้าง quiz มาด้วย (เอาแค่ username)
            .select('-questions.options.isCorrect')
            // ไม่ส่งเฉลยไปให้ (ซ่อน isCorrect)
            .sort({ createdAt: -1 })
            // เรียงจากใหม่ไปเก่า

        res.json(quizzes)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// =====================
// ดึง quiz ตาม ID
// =====================
exports.getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id)
            .populate('creatorId', 'username')

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' })
        }

        res.json(quiz)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// =====================
// ดึง quiz ของตัวเอง (ต้อง login)
// =====================
exports.getMyQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find({ creatorId: req.user.id })
            .sort({ createdAt: -1 })

        res.json(quizzes)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// =====================
// สร้าง quiz ใหม่ (ต้อง login)
// =====================
exports.createQuiz = async (req, res) => {
    try {
        const { title, description, questions, isPublic } = req.body

        if (!title) {
            return res.status(400).json({ message: 'Title is required' })
        }

        if (!questions || questions.length === 0) {
            return res.status(400).json({ message: 'At least one question is required' })
        }

        const newQuiz = new Quiz({
            title,
            description: description || '',
            questions,
            isPublic: isPublic || false,
            creatorId: req.user.id
        })

        const savedQuiz = await newQuiz.save()
        res.status(201).json(savedQuiz)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// =====================
// แก้ไข quiz (ต้อง login + เป็นเจ้าของ)
// =====================
exports.updateQuiz = async (req, res) => {
    try {
        // หา quiz ก่อน เพื่อตรวจว่าเป็นเจ้าของจริงไหม
        const quiz = await Quiz.findById(req.params.id)

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' })
        }

        // ตรวจว่า user เป็นเจ้าของ quiz นี้ไหม
        if (quiz.creatorId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to edit this quiz' })
        }

        const updatedQuiz = await Quiz.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        )

        res.json(updatedQuiz)
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

// =====================
// ลบ quiz (ต้อง login + เป็นเจ้าของ)
// =====================
exports.deleteQuiz = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id)

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' })
        }

        // ตรวจว่า user เป็นเจ้าของ quiz นี้ไหม
        if (quiz.creatorId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to delete this quiz' })
        }

        await Quiz.findByIdAndDelete(req.params.id)
        res.json({ message: 'Quiz deleted successfully' })
    } catch (err) {
        console.log(err)
        res.status(500).json({ message: 'Server Error' })
    }
}
