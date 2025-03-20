const express = require('express');
const router = express.Router();
const Skill = require('../models/Skills');

// Get all skills
router.get('/', async (req, res) => {
  try {
    const skills = await Skill.find();
    res.json(skills);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;