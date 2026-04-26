const User   = require('../Models/user')
const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')

exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body
        if (!username || !password) return res.status(400).json({ message: 'Username and password are required' })

        const existingUser = await User.findOne({ username })
        if (existingUser) return res.status(400).json({ message: 'Username already exists' })

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        const user = new User({ username, email: email || '', password: hashedPassword })
        await user.save()

        res.status(201).json({ message: 'Register success' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body
        if (!username || !password) return res.status(400).json({ message: 'Username and password are required' })

        const user = await User.findOne({ username })
        if (!user) return res.status(400).json({ message: 'Username not found' })

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) return res.status(400).json({ message: 'Invalid password' })

        const payload = { user: { id: user._id, username: user.username } }
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }, (err, token) => {
            if (err) throw err
            res.json({ token, user: { id: user._id, username: user.username, email: user.email } })
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Server Error' })
    }
}

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password')
        if (!user) return res.status(404).json({ message: 'User not found' })
        res.json(user)
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Server Error' })
    }
}
