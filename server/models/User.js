const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'Student' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  skills: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }],
  bio: { type: String, default: '' },
  profilePicture: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  acquaintances: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Add this line
});

module.exports = mongoose.model('User', userSchema);