const express = require('express');
const router = express.Router();
const Branch = require('../models/Branch');

// Get all branches
router.get('/', async (req, res) => {
  try {
    const branches = await Branch.find();
    res.json(branches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new branch (for testing)
router.post('/', async (req, res) => {
  const { name } = req.body;

  try {
    const branch = new Branch({ name });
    await branch.save();
    res.status(201).json(branch);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;