const Quiz = require('../Models/quiz')

// =====================
// เก็บข้อมูลเกมทั้งหมดไว้ใน memory (RAM)
// key = PIN, value = ข้อมูลเกม
// =====================
const games = {}

// สร้าง PIN 6 หลักแบบสุ่ม
function generatePin() {
    let pin
    do {
        pin = Math.floor(100000 + Math.random() * 900000).toString()
    } while (games[pin]) // ถ้า PIN ซ้ำกับเกมที่มีอยู่ → สุ่มใหม่
    return pin
}

// คำนวณคะแนน — ยิ่งตอบเร็วยิ่งได้มาก
function calculateScore(basePoints, timeLimit, timeLeft) {
    if (timeLeft <= 0) return 0
    // สูตร: คะแนนเต็ม * (เวลาที่เหลือ / เวลาทั้งหมด)
    // เช่น ตอบภายใน 5 วิจาก 20 วิ → 1000 * (15/20) = 750 คะแนน
    return Math.round(basePoints * (timeLeft / timeLimit))
}

// =====================
// ฟังก์ชันหลัก — รับ io (Socket.IO server) เข้ามา
// =====================
function setupGameHandler(io) {

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`)

        // ─────────────────────────────────
        // HOST: สร้างเกมใหม่
        // ─────────────────────────────────
        socket.on('game:create', async (data) => {
            try {
                const { quizId } = data

                // ดึง quiz จาก database
                const quiz = await Quiz.findById(quizId)
                if (!quiz) {
                    socket.emit('game:error', { message: 'Quiz not found' })
                    return
                }

                // สร้าง PIN และข้อมูลเกม
                const pin = generatePin()

                games[pin] = {
                    hostSocketId: socket.id,
                    quizId: quizId,
                    quiz: {
                        title: quiz.title,
                        questions: quiz.questions
                    },
                    players: {},
                    // players จะเก็บแบบ { socketId: { name, score, answers: [], streak: 0 } }
                    currentQuestion: -1,
                    // -1 = ยังไม่เริ่ม, 0 = คำถามข้อแรก, 1 = ข้อที่สอง ...
                    status: 'lobby',
                    // lobby = รอคนเข้า, playing = กำลังเล่น, finished = จบแล้ว
                    timer: null,
                    questionStartTime: null
                }

                // ให้ host เข้า "ห้อง" ของ PIN นี้
                socket.join(pin)

                // ส่ง PIN กลับไปให้ host
                socket.emit('game:created', {
                    pin,
                    quizTitle: quiz.title,
                    totalQuestions: quiz.questions.length
                })

                console.log(`Game created: PIN=${pin}, Quiz="${quiz.title}"`)
            } catch (err) {
                console.log(err)
                socket.emit('game:error', { message: 'Failed to create game' })
            }
        })

        // ─────────────────────────────────
        // PLAYER: เข้าร่วมเกม
        // ─────────────────────────────────
        socket.on('game:join', (data) => {
            const { pin, name } = data

            const game = games[pin]
            if (!game) {
                socket.emit('game:error', { message: 'Game not found. Check your PIN.' })
                return
            }

            if (game.status !== 'lobby') {
                socket.emit('game:error', { message: 'Game already started' })
                return
            }

            // ตรวจชื่อซ้ำ
            const nameTaken = Object.values(game.players).some(p => p.name === name)
            if (nameTaken) {
                socket.emit('game:error', { message: 'Name already taken' })
                return
            }

            // เพิ่มผู้เล่นเข้าเกม
            game.players[socket.id] = {
                name,
                score: 0,
                answers: [],
                streak: 0
            }

            // ให้ผู้เล่นเข้า "ห้อง" เดียวกับ host
            socket.join(pin)

            // บันทึก PIN ไว้ใน socket เพื่อใช้ตอน disconnect
            socket.pin = pin

            // บอก host ว่ามีคนเข้ามา
            io.to(game.hostSocketId).emit('game:player-joined', {
                name,
                playerCount: Object.keys(game.players).length,
                players: Object.values(game.players).map(p => p.name)
            })

            // บอกผู้เล่นว่าเข้าสำเร็จ
            socket.emit('game:joined', {
                name,
                pin,
                quizTitle: game.quiz.title,
                totalQuestions: game.quiz.questions.length
            })

            console.log(`Player "${name}" joined game ${pin}`)
        })

        // ─────────────────────────────────
        // HOST: เริ่มเกม
        // ─────────────────────────────────
        socket.on('game:start', (data) => {
            const { pin } = data
            const game = games[pin]

            if (!game || game.hostSocketId !== socket.id) {
                socket.emit('game:error', { message: 'Not authorized' })
                return
            }

            if (Object.keys(game.players).length === 0) {
                socket.emit('game:error', { message: 'No players in the game' })
                return
            }

            game.status = 'playing'
            game.currentQuestion = -1

            // บอกทุกคนในห้องว่าเกมเริ่มแล้ว
            io.to(pin).emit('game:started', {
                totalQuestions: game.quiz.questions.length
            })

            console.log(`Game ${pin} started with ${Object.keys(game.players).length} players`)
        })

        // ─────────────────────────────────
        // HOST: ส่งคำถามถัดไป
        // ─────────────────────────────────
        socket.on('game:next-question', (data) => {
            const { pin } = data
            const game = games[pin]

            if (!game || game.hostSocketId !== socket.id) {
                socket.emit('game:error', { message: 'Not authorized' })
                return
            }

            // ล้าง timer เก่า (ถ้ามี)
            if (game.timer) {
                clearTimeout(game.timer)
            }

            game.currentQuestion++
            const qIndex = game.currentQuestion
            const questions = game.quiz.questions

            // ตรวจว่ายังมีคำถามเหลือไหม
            if (qIndex >= questions.length) {
                // หมดคำถามแล้ว → จบเกม
                endGame(io, pin)
                return
            }

            const question = questions[qIndex]
            game.questionStartTime = Date.now()

            // ส่งคำถามไป HOST (รวมเฉลย)
            io.to(game.hostSocketId).emit('game:question', {
                questionIndex: qIndex,
                totalQuestions: questions.length,
                questionText: question.questionText,
                questionType: question.questionType,
                options: question.options, // host เห็นเฉลย
                timeLimit: question.timeLimit,
                points: question.points
            })

            // ส่งคำถามไป PLAYERS (ไม่มีเฉลย)
            const playerSocketIds = Object.keys(game.players)
            playerSocketIds.forEach(sid => {
                io.to(sid).emit('game:question', {
                    questionIndex: qIndex,
                    totalQuestions: questions.length,
                    questionText: question.questionText,
                    questionType: question.questionType,
                    options: question.options.map(opt => ({ text: opt.text })),
                    // ส่งแค่ text ไม่ส่ง isCorrect
                    timeLimit: question.timeLimit,
                    points: question.points
                })
            })

            // ตั้ง timer — หมดเวลาอัตโนมัติ
            game.timer = setTimeout(() => {
                timeUp(io, pin)
            }, question.timeLimit * 1000)

            console.log(`Game ${pin}: Question ${qIndex + 1}/${questions.length}`)
        })

        // ─────────────────────────────────
        // PLAYER: ส่งคำตอบ
        // ─────────────────────────────────
        socket.on('game:answer', (data) => {
            const { pin, answerIndex } = data
            const game = games[pin]

            if (!game || game.status !== 'playing') return

            const player = game.players[socket.id]
            if (!player) return

            const qIndex = game.currentQuestion
            const question = game.quiz.questions[qIndex]

            // ตรวจว่าตอบไปแล้วหรือยัง (ห้ามตอบซ้ำ)
            if (player.answers[qIndex] !== undefined) return

            // คำนวณเวลาที่ใช้ตอบ
            const timeElapsed = (Date.now() - game.questionStartTime) / 1000
            const timeLeft = Math.max(0, question.timeLimit - timeElapsed)

            // ตรวจคำตอบ
            const isCorrect = question.options[answerIndex]?.isCorrect === true

            // คำนวณคะแนน
            let earnedPoints = 0
            if (isCorrect) {
                earnedPoints = calculateScore(question.points, question.timeLimit, timeLeft)
                player.score += earnedPoints
                player.streak++
            } else {
                player.streak = 0
            }

            // บันทึกคำตอบ
            player.answers[qIndex] = {
                answerIndex,
                isCorrect,
                earnedPoints,
                timeElapsed: Math.round(timeElapsed * 10) / 10
            }

            // บอกผู้เล่นว่าตอบถูกหรือผิด
            socket.emit('game:answer-result', {
                isCorrect,
                earnedPoints,
                totalScore: player.score,
                streak: player.streak,
                correctAnswerIndex: isCorrect ? answerIndex : question.options.findIndex(o => o.isCorrect)
            })

            // บอก host ว่ามีคนตอบแล้ว (ไม่บอกว่าตอบอะไร)
            const answeredCount = Object.values(game.players)
                .filter(p => p.answers[qIndex] !== undefined).length
            const totalPlayers = Object.keys(game.players).length

            io.to(game.hostSocketId).emit('game:answer-count', {
                answeredCount,
                totalPlayers
            })

            // ถ้าทุกคนตอบแล้ว → หมดเวลาเลย (ไม่ต้องรอ timer)
            if (answeredCount >= totalPlayers) {
                if (game.timer) {
                    clearTimeout(game.timer)
                }
                timeUp(io, pin)
            }

            console.log(`Game ${pin}: ${player.name} answered Q${qIndex + 1} — ${isCorrect ? 'CORRECT' : 'WRONG'}`)
        })

        // ─────────────────────────────────
        // HOST: ขอดู reveal (เฉลยคำตอบ)
        // ─────────────────────────────────
        socket.on('game:get-reveal', (data) => {
            const { pin } = data
            const game = games[pin]

            if (!game || game.hostSocketId !== socket.id) return

            const qIndex = game.currentQuestion
            const question = game.quiz.questions[qIndex]

            // นับว่าแต่ละตัวเลือกมีกี่คนเลือก
            const answerCounts = question.options.map(() => 0)
            Object.values(game.players).forEach(player => {
                const ans = player.answers[qIndex]
                if (ans !== undefined && answerCounts[ans.answerIndex] !== undefined) {
                    answerCounts[ans.answerIndex]++
                }
            })

            const totalAnswered = answerCounts.reduce((a, b) => a + b, 0)

            socket.emit('game:reveal', {
                questionIndex: qIndex,
                questionText: question.questionText,
                options: question.options.map((opt, i) => ({
                    text: opt.text,
                    isCorrect: opt.isCorrect,
                    count: answerCounts[i],
                    percentage: totalAnswered > 0
                        ? Math.round((answerCounts[i] / totalAnswered) * 100)
                        : 0
                })),
                totalAnswered
            })
        })

        // ─────────────────────────────────
        // HOST: ขอดู scoreboard
        // ─────────────────────────────────
        socket.on('game:get-scoreboard', (data) => {
            const { pin } = data
            const game = games[pin]

            if (!game || game.hostSocketId !== socket.id) return

            const qIndex = game.currentQuestion

            // สร้าง scoreboard เรียงจากคะแนนมากไปน้อย
            const scoreboard = Object.values(game.players)
                .map(player => {
                    const lastAnswer = player.answers[qIndex]
                    return {
                        name: player.name,
                        score: player.score,
                        streak: player.streak,
                        delta: lastAnswer ? lastAnswer.earnedPoints : 0
                        // delta = คะแนนที่ได้จากข้อล่าสุด
                    }
                })
                .sort((a, b) => b.score - a.score)

            socket.emit('game:scoreboard', {
                questionIndex: qIndex,
                totalQuestions: game.quiz.questions.length,
                scoreboard
            })
        })

        // ─────────────────────────────────
        // HOST: จบเกมก่อนเวลา
        // ─────────────────────────────────
        socket.on('game:force-end', (data) => {
            const { pin } = data
            const game = games[pin]

            if (!game || game.hostSocketId !== socket.id) return

            endGame(io, pin)
        })

        // ─────────────────────────────────
        // ตัดการเชื่อมต่อ (ปิดหน้าเว็บ, หลุด internet)
        // ─────────────────────────────────
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`)

            // ตรวจทุกเกมว่า socket นี้เป็นใคร
            for (const pin in games) {
                const game = games[pin]

                // ถ้าเป็น host ที่หลุด → จบเกม
                if (game.hostSocketId === socket.id) {
                    io.to(pin).emit('game:host-disconnected', {
                        message: 'Host has disconnected. Game ended.'
                    })
                    if (game.timer) clearTimeout(game.timer)
                    delete games[pin]
                    console.log(`Game ${pin} ended: host disconnected`)
                    break
                }

                // ถ้าเป็นผู้เล่นที่หลุด
                if (game.players[socket.id]) {
                    const playerName = game.players[socket.id].name
                    delete game.players[socket.id]

                    // บอก host ว่าผู้เล่นออกไป
                    io.to(game.hostSocketId).emit('game:player-left', {
                        name: playerName,
                        playerCount: Object.keys(game.players).length,
                        players: Object.values(game.players).map(p => p.name)
                    })

                    console.log(`Player "${playerName}" left game ${pin}`)
                    break
                }
            }
        })
    })
}

// =====================
// หมดเวลา
// =====================
function timeUp(io, pin) {
    const game = games[pin]
    if (!game) return

    const qIndex = game.currentQuestion
    const question = game.quiz.questions[qIndex]

    // บอกทุกคนว่าหมดเวลา
    io.to(pin).emit('game:time-up', {
        questionIndex: qIndex,
        correctAnswerIndex: question.options.findIndex(o => o.isCorrect)
    })
}

// =====================
// จบเกม
// =====================
function endGame(io, pin) {
    const game = games[pin]
    if (!game) return

    if (game.timer) clearTimeout(game.timer)
    game.status = 'finished'

    // สร้างผลลัพธ์สุดท้าย เรียงตามคะแนน
    const finalResults = Object.values(game.players)
        .map(player => ({
            name: player.name,
            score: player.score,
            correctCount: player.answers.filter(a => a && a.isCorrect).length,
            totalQuestions: game.quiz.questions.length
        }))
        .sort((a, b) => b.score - a.score)

    // ส่งผลลัพธ์ให้ทุกคน
    io.to(pin).emit('game:final-results', {
        quizTitle: game.quiz.title,
        results: finalResults,
        totalQuestions: game.quiz.questions.length
    })

    // อัพเดท playCount ของ quiz
    Quiz.findByIdAndUpdate(game.quizId, { $inc: { playCount: 1 } }).catch(() => {})

    // ลบเกมออกจาก memory หลัง 60 วินาที
    setTimeout(() => {
        delete games[pin]
        console.log(`Game ${pin} cleaned up`)
    }, 60000)

    console.log(`Game ${pin} ended. Winner: ${finalResults[0]?.name || 'No players'}`)
}

module.exports = { setupGameHandler, games }
