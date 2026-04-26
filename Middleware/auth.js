const jwt = require('jsonwebtoken')

const auth = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization']
        if (!authHeader) return res.status(401).json({ message: 'No token, access denied' })

        const token = authHeader.split(' ')[1]
        if (!token) return res.status(401).json({ message: 'Token format invalid' })

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded.user
        next()
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired, please login again' })
        }
        return res.status(401).json({ message: 'Token is not valid' })
    }
}

module.exports = auth
