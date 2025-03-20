const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Unified search for posts, users, and tags
router.get('/', auth, async (req, res) => {
  try {
    const query = req.query.query ? req.query.query.toLowerCase() : '';

    // Search posts by title, description, or tags
    const posts = await Post.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } },
      ],
    }).populate('author', 'name email');

    // Search users by name or email
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
      _id: { $ne: req.userId }, // Exclude the current user
    }).select('name email branch skills bio');

    // Search tags (extract unique tags from posts)
    const allPosts = await Post.find();
    const tagsSet = new Set();
    allPosts.forEach(post => {
      post.tags.forEach(tag => {
        if (tag.toLowerCase().includes(query)) {
          tagsSet.add(tag);
        }
      });
    });
    const tags = Array.from(tagsSet);

    res.json({ posts, users, tags });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;