const express = require('express');
const router = express.Router();
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

router.post('/login', async (req, res) => {
  try {
    const { username, password, userType } = req.body;
    if (!username || !password || !userType) {
      return res.status(400).json({ message: 'Missing credentials' });
    }
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }
    if (user.userType !== userType) {
      return res.status(400).json({ message: 'Invalid user type' });
    }
    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
    }
    const token = jwt.sign(
      { id: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ token, userType: user.userType });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, password, userType } = req.body;
    if (!username || !password || !userType) {
      return res.status(400).json({ message: 'Missing credentials' });
    }
    if (userType !== 'freelancer' && userType !== 'employer') {
      return res.status(400).json({ message: 'Invalid user type' });
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    const hashedPassword = await bcryptjs.hash(password, 8);
    const user = new User({
      username,
      password: hashedPassword,
      userType,
      skills: userType === 'freelancer' ? [] : undefined,
      bio: '',
      photo: '',
      schooling: userType === 'freelancer' ? '' : undefined,
      degree: userType === 'freelancer' ? '' : undefined,
      certification: userType === 'freelancer' ? '' : undefined,
      totalEarned: userType === 'freelancer' ? 0 : undefined,
      pendingPayments: userType === 'freelancer' ? 0 : undefined,
      company: userType === 'employer' ? '' : undefined,
      totalSpent: userType === 'employer' ? 0 : undefined,
    });
    await user.save();
    const token = jwt.sign(
      { id: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.status(201).json({ token, userType: user.userType });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;