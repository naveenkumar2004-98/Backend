const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Freelancer = require('../models/Freelancer');

// Configure multer to save images in /uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// POST /api/freelancers - Save freelancer details
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, skills, bio } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

    const freelancer = new Freelancer({ name, skills, bio, image: imagePath });
    await freelancer.save();

    res.status(201).json({ message: 'Freelancer profile created', freelancer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
