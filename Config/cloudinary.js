const cloudinary = require('cloudinary').v2
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const multer = require('multer')

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

const quizCoverStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'dataquiz/covers',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 800, height: 450, crop: 'fill' }]
    }
})

const questionImageStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'dataquiz/questions',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 600, height: 400, crop: 'limit' }]
    }
})

const uploadCover = multer({
    storage: quizCoverStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        console.log('=== FILE RECEIVED ===', file.originalname, file.mimetype)
        cb(null, true)
    }
})

const uploadQuestionImage = multer({
    storage: questionImageStorage,
    limits: { fileSize: 5 * 1024 * 1024 }
})

module.exports = { cloudinary, uploadCover, uploadQuestionImage }
