const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
// Create a new post
router.post('/', auth, async (req, res) => {
  const { title, description, tags } = req.body;

  try {
    const post = new Post({
      title,
      description,
      tags,
      author: req.userId,
    });

    await post.save();
    await post.populate('author', 'name email');
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all posts
router.get('/', auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', 'name email')
      .populate('comments.user', 'name');
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Like a post
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userIndex = post.likes.indexOf(req.userId);
    if (userIndex === -1) {
      post.likes.push(req.userId);
    } else {
      post.likes.splice(userIndex, 1);
    }

    await post.save();
    await post.populate('author', 'name email');
    await post.populate('comments.user', 'name');
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Comment on a post
router.post('/:id/comment', auth, async (req, res) => {
  const { text } = req.body;

  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    post.comments.push({
      user: req.userId,
      text,
    });

    await post.save();
    await post.populate('author', 'name email');
    await post.populate('comments.user', 'name');
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Search posts by title, description, or tags
router.get('/search', auth, async (req, res) => {
  const { query } = req.query;
  try {
    const posts = await Post.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } },
      ],
    })
      .populate('author', 'name email')
      .populate('comments.user', 'name');
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get posts by the logged-in user
router.get('/user/me', auth, async (req, res) => {
  try {
    const posts = await Post.find({ author: req.userId })
      .populate('author', 'name email')
      .populate('comments.user', 'name');
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get posts by a specific user (for use in UserProfile.js)
router.get('/user/:id', auth, async (req, res) => {
  try {
    const posts = await Post.find({ author: req.params.id })
      .populate('author', 'name email')
      .populate('comments.user', 'name');
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get recommended posts
router.get('/recommendations', auth, async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Recommend posts based on user’s branch, skills, or tags they’ve interacted with
      const recommendedPosts = await Post.find({
        $or: [
          { branch: user.branch },
          { tags: { $in: user.skills.map(skill => skill.name) } },
        ],
      }).populate('author', 'name email').sort({ createdAt: -1 }).limit(5);
  
      res.json(recommendedPosts);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Get posts by tag
  router.get('/by-tag/:tag', auth, async (req, res) => {
    try {
      const tag = req.params.tag;
      const posts = await Post.find({ tags: tag })
        .populate('author', 'name email')
        .sort({ createdAt: -1 });
      res.json(posts);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  router.delete('/:id', auth, async (req, res) => {
    try {
      // Validate the postId
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid post ID' });
      }
  
      // Check if req.userId is set by the auth middleware
      if (!req.userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
  
      const post = await Post.findById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }
  
      // Check if the user is the author of the post
      if (post.author.toString() !== req.userId) {
        return res.status(403).json({ message: 'You are not authorized to delete this post' });
      }
  
      await Post.deleteOne({ _id: req.params.id });
      res.json({ message: 'Post deleted successfully' });
    } catch (err) {
      console.error('Error deleting post:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });
module.exports = router;