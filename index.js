// app.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Set up EJS
app.set('view engine', 'ejs');

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads');
        }
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => {
    // Read uploads directory for existing files
    fs.readdir('uploads', (err, files) => {
        const uploadedFiles = err ? [] : files;
        res.render('index', { files: uploadedFiles });
    });
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ 
        filename: req.file.filename,
        originalname: req.file.originalname
    });
});

const PORT = process.env.PORT || 3009;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});