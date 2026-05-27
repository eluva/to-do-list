const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
//const { OAuth2Client } = require('google-auth-library');
//const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); 
const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });
    const user = new User({ email, password });
    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, userId: user._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Firebase Google Sign-In
router.post('/google', async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'ID token required' });
  
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const { email, uid } = decodedToken;
  
      if (!email) return res.status(400).json({ message: 'Email not provided' });
  
      let user = await User.findOne({ $or: [{ googleId: uid }, { email }] });
  
      if (user) {
        if (!user.googleId) {
          user.googleId = uid;
          await user.save();
        }
      } else {
        user = new User({ email, googleId: uid });
        await user.save();
      }
  
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, userId: user._id });
    } catch (err) {
      console.error('Firebase auth error:', err);
      res.status(401).json({ message: 'Invalid Firebase token' });
    }
  });

module.exports = router;