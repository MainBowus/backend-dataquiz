const Quiz = require('../Models/quiz')

const games = {}

function generatePin() {
    let pin
    do {
        pin = Math.floor(100000 + Math.random() * 900000).toString()
    } while (games[pin])
    return pin
}

function calculateScore(basePoints, timeLimit, timeLeft) {
    if (timeLeft <= 0) return 0
    return Math.round(basePoints * (timeLeft / timeLimit))
}

// เช็คว่าเป็น host ของ game นี้ไหม (รองรับ reconnect)
function isHost(game, socketId, pin) {
    if (!game) return false
    // ถ้า socket id ตรง → เป็น host
    if (game.hostSocketId === socketId) return true
    // ถ้า socket id ไม่ตรง แต่ pin ตรง และ game ยัง playing → อนุญาต host reconnect
    if (game.hostPin === pin) {
        game.hostSocketId = socketId  // อัปเดต socket id ใหม่
        return true
    }
    return false
}

function setupGameHandler(io) {
    io.on('connection', (socket) => {
        console.log('Socket connected:', socket.id)

        // HOST: สร้างเกมใหม่
        socket.on('game:create', async (data) => {
            try {
                const { quizId } = data
                const quiz = await Quiz.findById(quizId)
                if (!quiz) {
                    socket.emit('game:error', { message: 'Quiz not found' })
                    return
                }

                const pin = generatePin()
                games[pin] = {
                    hostSocketId: socket.id,
                    hostPin: pin,  // เก็บ pin ไว้ให้ host reconnect ได้
                    quizId,
                    quiz: { title: quiz.title, questions: quiz.questions },
                    players: {},
                    currentQuestion: -1,
                    status: 'lobby',
                    timer: null,
                    questionStartTime: null
                }

                socket.join(pin)
                socket.emit('game:created', {
                    pin,
                    quizTitle: quiz.title,
                    totalQuestions: quiz.questions.length
                })
                console.log('Game created: PIN=' + pin + ', Quiz="' + quiz.title + '"')
            } catch (err) {
                console.log(err)
                socket.emit('game:error', { message: 'Failed to create game' })
            }
        })

        // HOST: reconnect เข้า game ที่มีอยู่แล้ว
        socket.on('game:reconnect-host', (data) => {
            const { pin } = data
            const game = games[pin]
            if (!game) {
                socket.emit('game:error', { message: 'Game not found' })
                return
            }
            game.hostSocketId = socket.id
            socket.join(pin)
            socket.emit('game:reconnected', {
                pin,
                quizTitle: game.quiz.title,
                totalQuestions: game.quiz.questions.length,
                currentQuestion: game.currentQuestion,
                status: game.status
            })
            console.log('Host reconnected to game ' + pin)
        })

        // PLAYER: เข้าร่วมเกม
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
            const nameTaken = Object.values(game.players).some(p => p.name === name)
            if (nameTaken) {
                socket.emit('game:error', { message: 'Name already taken' })
                return
            }

            game.players[socket.id] = { name, score: 0, answers: [], streak: 0 }
            socket.join(pin)
            socket.pin = pin

            io.to(game.hostSocketId).emit('game:player-joined', {
                name,
                playerCount: Object.keys(game.players).length,
                players: Object.values(game.players).map(p => p.name)
            })

            socket.emit('game:joined', {
                name, pin,
                quizTitle: game.quiz.title,
                totalQuestions: game.quiz.questions.length
            })
            console.log('Player "' + name + '" joined game ' + pin)
        })

        // HOST: เริ่มเกม
        socket.on('game:start', (data) => {
            const { pin } = data
            const game = games[pin]

            if (!isHost(game, socket.id, pin)) {
                socket.emit('game:error', { message: 'Not authorized' })
                return
            }
            if (Object.keys(game.players).length === 0) {
                socket.emit('game:error', { message: 'No players in the game' })
                return
            }

            game.status = 'playing'
            game.currentQuestion = -1
            io.to(pin).emit('game:started', { totalQuestions: game.quiz.questions.length })
            console.log('Game ' + pin + ' started with ' + Object.keys(game.players).length + ' players')
        })

        // HOST: ส่งคำถามถัดไป
        socket.on('game:next-question', (data) => {
            const { pin } = data
            const game = games[pin]

            if (!isHost(game, socket.id, pin)) {
                socket.emit('game:error', { message: 'Not authorized' })
                return
            }

            if (game.timer) clearTimeout(game.timer)

            game.currentQuestion++
            const qIndex = game.currentQuestion
            const questions = game.quiz.questions

            if (qIndex >= questions.length) {
                endGame(io, pin)
                return
            }

            const question = questions[qIndex]
            game.questionStartTime = Date.now()

            // ส่งให้ host
            socket.emit('game:question', {
                questionIndex: qIndex,
                totalQuestions: questions.length,
                questionText: question.questionText,
                questionType: question.questionType,
                options: question.options,
                timeLimit: question.timeLimit,
                points: question.points
            })

            // ส่งให้ players (ไม่มีเฉลย)
            Object.keys(game.players).forEach(sid => {
                io.to(sid).emit('game:question', {
                    questionIndex: qIndex,
                    totalQuestions: questions.length,
                    questionText: question.questionText,
                    questionType: question.questionType,
                    options: question.options.map(opt => ({ text: opt.text })),
                    timeLimit: question.timeLimit,
                    points: question.points
                })
            })

            game.timer = setTimeout(() => {
                timeUp(io, pin)
            }, question.timeLimit * 1000)

            console.log('Game ' + pin + ': Question ' + (qIndex + 1) + '/' + questions.length)
        })

        // PLAYER: ส่งคำตอบ
        socket.on('game:answer', (data) => {
            const { pin, answerIndex } = data
            const game = games[pin]

            if (!game || game.status !== 'playing') return

            const player = game.players[socket.id]
            if (!player) return

            const qIndex = game.currentQuestion
            const question = game.quiz.questions[qIndex]

            if (player.answers[qIndex] !== undefined) return

            const timeElapsed = (Date.now() - game.questionStartTime) / 1000
            const timeLeft = Math.max(0, question.timeLimit - timeElapsed)
            const isCorrect = question.options[answerIndex]?.isCorrect === true

            let earnedPoints = 0
            if (isCorrect) {
                earnedPoints = calculateScore(question.points, question.timeLimit, timeLeft)
                player.score += earnedPoints
                player.streak++
            } else {
                player.streak = 0
            }

            player.answers[qIndex] = {
                answerIndex, isCorrect, earnedPoints,
                timeElapsed: Math.round(timeElapsed * 10) / 10
            }

            socket.emit('game:answer-result', {
                isCorrect, earnedPoints,
                totalScore: player.score,
                streak: player.streak,
                correctAnswerIndex: isCorrect ? answerIndex : question.options.findIndex(o => o.isCorrect)
            })

            const answeredCount = Object.values(game.players).filter(p => p.answers[qIndex] !== undefined).length
            const totalPlayers = Object.keys(game.players).length

            io.to(game.hostSocketId).emit('game:answer-count', { answeredCount, totalPlayers })

            if (answeredCount >= totalPlayers) {
                if (game.timer) clearTimeout(game.timer)
                timeUp(io, pin)
            }

            console.log('Game ' + pin + ': ' + player.name + ' answered Q' + (qIndex + 1) + ' - ' + (isCorrect ? 'CORRECT' : 'WRONG'))
        })

        // HOST: ขอดู reveal
        socket.on('game:get-reveal', (data) => {
            const { pin } = data
            const game = games[pin]
            if (!isHost(game, socket.id, pin)) return

            const qIndex = game.currentQuestion
            const question = game.quiz.questions[qIndex]
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
                    percentage: totalAnswered > 0 ? Math.round((answerCounts[i] / totalAnswered) * 100) : 0
                })),
                totalAnswered
            })
        })

        // HOST: ขอดู scoreboard
        socket.on('game:get-scoreboard', (data) => {
            const { pin } = data
            const game = games[pin]
            if (!isHost(game, socket.id, pin)) return

            const qIndex = game.currentQuestion
            const scoreboard = Object.values(game.players)
                .map(player => {
                    const lastAnswer = player.answers[qIndex]
                    return {
                        name: player.name,
                        score: player.score,
                        streak: player.streak,
                        delta: lastAnswer ? lastAnswer.earnedPoints : 0
                    }
                })
                .sort((a, b) => b.score - a.score)

            socket.emit('game:scoreboard', {
                questionIndex: qIndex,
                totalQuestions: game.quiz.questions.length,
                scoreboard
            })
        })

        // HOST: จบเกมก่อนเวลา
        socket.on('game:force-end', (data) => {
            const { pin } = data
            const game = games[pin]
            if (!isHost(game, socket.id, pin)) return
            endGame(io, pin)
        })

        // disconnect
        socket.on('disconnect', () => {
            console.log('Socket disconnected:', socket.id)
            for (const pin in games) {
                const game = games[pin]
                if (game.hostSocketId === socket.id) {
                    // Host หลุด → รอ reconnect 30 วิ ก่อนจบเกม
                    game._hostDisconnectTimer = setTimeout(() => {
                        io.to(pin).emit('game:host-disconnected', { message: 'Host has disconnected. Game ended.' })
                        if (game.timer) clearTimeout(game.timer)
                        delete games[pin]
                        console.log('Game ' + pin + ' ended: host disconnected')
                    }, 30000)
                    break
                }
                if (game.players[socket.id]) {
                    const playerName = game.players[socket.id].name
                    delete game.players[socket.id]
                    io.to(game.hostSocketId).emit('game:player-left', {
                        name: playerName,
                        playerCount: Object.keys(game.players).length,
                        players: Object.values(game.players).map(p => p.name)
                    })
                    console.log('Player "' + playerName + '" left game ' + pin)
                    break
                }
            }
        })
    })
}

function timeUp(io, pin) {
    const game = games[pin]
    if (!game) return
    const question = game.quiz.questions[game.currentQuestion]
    io.to(pin).emit('game:time-up', {
        questionIndex: game.currentQuestion,
        correctAnswerIndex: question.options.findIndex(o => o.isCorrect)
    })
}

function endGame(io, pin) {
    const game = games[pin]
    if (!game) return

    if (game.timer) clearTimeout(game.timer)
    game.status = 'finished'

    const finalResults = Object.values(game.players)
        .map(player => ({
            name: player.name,
            score: player.score,
            correctCount: player.answers.filter(a => a && a.isCorrect).length,
            totalQuestions: game.quiz.questions.length
        }))
        .sort((a, b) => b.score - a.score)

    io.to(pin).emit('game:final-results', {
        quizTitle: game.quiz.title,
        results: finalResults,
        totalQuestions: game.quiz.questions.length
    })

    Quiz.findByIdAndUpdate(game.quizId, { $inc: { playCount: 1 } }).catch(() => {})

    setTimeout(() => {
        delete games[pin]
        console.log('Game ' + pin + ' cleaned up')
    }, 60000)

    console.log('Game ' + pin + ' ended. Winner: ' + (finalResults[0]?.name || 'No players'))
}

module.exports = { setupGameHandler, games }