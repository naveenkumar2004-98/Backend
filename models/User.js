const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userType: { type: String, required: true, enum: ['freelancer', 'employer'] },
  skills: [{ type: String }],
  bio: { type: String },
  photo: { type: String },
  schooling: { type: String },
  degree: { type: String },
  certification: { type: String },
  totalEarned: { type: Number },
  pendingPayments: { type: Number },
  company: { type: String },
  totalSpent: { type: Number },
  ratings: { type: Number, min: 0, max: 5 },
});

module.exports = mongoose.model('User', userSchema);