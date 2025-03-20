const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Request = require('../models/Request');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb('Error: Images only (jpeg, jpg, png)!');
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});
// Register a new user
router.post('/register', async (req, res) => {
    const { name, email, password, branch, skills } = req.body;
  
    try {
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }
  
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
  
      user = new User({
        name,
        email,
        password: hashedPassword,
        branch,
        skills,
      });
  
      await user.save();
  
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
      res.status(201).json({ token, userId: user._id });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Login a user
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
  
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
  
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
      res.json({ token, userId: user._id });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  router.get('/profile', auth, async (req, res) => {
    try {
      console.log('Fetching user profile for userId:', req.userId);
  
      if (!req.userId) {
        console.log('req.userId is undefined');
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
      }
  
      console.log('Querying user...');
      // Fetch the user without population first
      const rawUser = await User.findById(req.userId).select('-password');
      if (!rawUser) {
        console.log('User not found for userId:', req.userId);
        return res.status(404).json({ message: 'User not found' });
      }
      console.log('Raw user (before population):', rawUser);
  
      // Now populate the fields
      const user = await User.findById(req.userId)
        .select('-password')
        .populate('branch')
        .populate('skills')
        .populate('acquaintances', 'name email');
      if (!user) {
        console.log('User not found for userId:', req.userId);
        return res.status(404).json({ message: 'User not found' });
      }
      console.log('User fetched (after population):', user);
  
      console.log('Fetching pending requests...');
      const pendingRequests = await Request.find({
        to: req.userId,
        status: 'pending'
      }).populate('from', 'name email');
      console.log('Pending requests:', pendingRequests);
  
      console.log('Sending response...');
      res.json({ ...user.toObject(), pendingRequests });
    } catch (err) {
      console.error('Error in GET /api/users/profile:', err);
      res.status(500).json({ message: err.message });
    }
  });
router.delete('/acquaintances/:acquaintanceId', auth, async (req, res) => {
    try {
      // Check if req.userId is set by the auth middleware
      if (!req.userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
  
      // Validate the acquaintanceId
      if (!mongoose.Types.ObjectId.isValid(req.params.acquaintanceId)) {
        return res.status(400).json({ message: 'Invalid acquaintance ID' });
      }
  
      // Find the current user
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Check if the acquaintance exists in the user's acquaintances
      if (!user.acquaintances.includes(req.params.acquaintanceId)) {
        return res.status(400).json({ message: 'Acquaintance not found in your list' });
      }
  
      // Find the acquaintance
      const acquaintance = await User.findById(req.params.acquaintanceId);
      if (!acquaintance) {
        return res.status(404).json({ message: 'Acquaintance not found' });
      }
  
      // Remove the acquaintance from the user's acquaintances
      user.acquaintances = user.acquaintances.filter(
        id => id.toString() !== req.params.acquaintanceId
      );
  
      // Remove the user from the acquaintance's acquaintances
      acquaintance.acquaintances = acquaintance.acquaintances.filter(
        id => id.toString() !== req.userId
      );
  
      // Save both users
      await user.save();
      await acquaintance.save();
  
      // Populate the updated user data to return
      const updatedUser = await User.findById(req.userId)
        .populate('branch')
        .populate('skills')
        .populate('acquaintances')
        .populate({ path: 'pendingRequests.from', strictPopulate: false })
        .select('-password');
  
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found after update' });
      }
  
      res.json({ message: 'Acquaintance removed successfully', user: updatedUser });
    } catch (err) {
      console.error('Error removing acquaintance:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });
// Update logged-in user's profile
router.put('/profile', auth, upload.single('profilePicture'), async (req, res) => {
  try {
    console.log('PUT /api/users/profile called for userId:', req.userId);
    console.log('Request body:', req.body);
    console.log('File:', req.file);

    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.email) updates.email = req.body.email;
    if (req.body.bio) updates.bio = req.body.bio;

    if (req.body.branch) {
      if (!mongoose.Types.ObjectId.isValid(req.body.branch)) {
        console.log('Invalid branch ID:', req.body.branch);
        return res.status(400).json({ message: 'Invalid branch ID' });
      }
      updates.branch = req.body.branch;
    } else if (req.body.branch === '') {
      updates.branch = null;
    }

    if (req.body.skills) {
      console.log('Processing skills:', req.body.skills);
      updates.skills = req.body.skills;
      if (!Array.isArray(updates.skills)) {
        console.log('Skills is not an array:', updates.skills);
        return res.status(400).json({ message: 'Skills must be an array' });
      }
      updates.skills = updates.skills.map(skillId => {
        if (!mongoose.Types.ObjectId.isValid(skillId)) {
          console.log('Invalid skill ID:', skillId);
          throw new Error(`Invalid skill ID: ${skillId}`);
        }
        return skillId;
      });
    }

    if (req.file) updates.profilePicture = `uploads/${req.file.filename}`;
    console.log('Updates to apply:', updates);

    if (req.body.email) {
      console.log('Checking for existing email:', req.body.email);
      const existingUser = await User.findOne({ email: req.body.email });
      if (existingUser && existingUser._id.toString() !== req.userId) {
        console.log('Email already in use by user:', existingUser._id);
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    console.log('Updating user...');
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true }
    )
      .select('-password')
      .populate('branch')
      .populate('skills')
      .populate('acquaintances', 'name email');

    if (!user) {
      console.log('User not found for userId:', req.userId);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('User updated:', user);

    console.log('Sending response...');
    res.json(user);
  } catch (err) {
    console.error('Error in PUT /api/users/profile:', err);
    res.status(500).json({ message: err.message });
  }
});

// Search users by name or email
router.get('/search', auth, async (req, res) => {
  const { query } = req.query;
  try {
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ],
      _id: { $ne: req.userId }
    }).select('name email');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send a friend request
router.post('/requests/:id', auth, async (req, res) => {
  try {
    const toUser = await User.findById(req.params.id);
    if (!toUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingRequest = await Request.findOne({
      from: req.userId,
      to: req.params.id,
      status: 'pending'
    });
    if (existingRequest) {
      return res.status(400).json({ message: 'Request already sent' });
    }

    const request = new Request({
      from: req.userId,
      to: req.params.id,
    });
    await request.save();

    const fromUser = await User.findById(req.userId);
    const notification = new Notification({
      user: req.params.id,
      type: 'friend_request',
      message: `${fromUser.name} sent you a friend request`,
      relatedId: request._id,
    });
    await notification.save();

    res.status(201).json({ message: 'Request sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/requests/:id/accept', auth, async (req, res) => {
    try {
      console.log('Accepting request ID:', req.params.id);
      const request = await Request.findById(req.params.id);
      if (!request) {
        console.log('Request not found');
        return res.status(404).json({ message: 'Request not found' });
      }
      console.log('Request found:', request);
  
      if (request.to.toString() !== req.userId) {
        console.log('Unauthorized access attempt');
        return res.status(403).json({ message: 'Unauthorized' });
      }
  
      console.log('Updating request status to accepted');
      request.status = 'accepted';
      await request.save();
      console.log('Request status updated');
  
      console.log('Fetching fromUser:', request.from);
      const fromUser = await User.findById(request.from);
      console.log('Fetching toUser:', request.to);
      const toUser = await User.findById(request.to);
      if (!fromUser || !toUser) {
        console.log('One of the users not found');
        return res.status(404).json({ message: 'One of the users not found' });
      }
      console.log('fromUser:', fromUser);
      console.log('toUser:', toUser);
  
      if (!fromUser.acquaintances.includes(toUser._id)) {
        console.log('Adding toUser to fromUser.acquaintances');
        fromUser.acquaintances.push(toUser._id);
        await fromUser.save();
        console.log('fromUser updated');
      }
  
      if (!toUser.acquaintances.includes(fromUser._id)) {
        console.log('Adding fromUser to toUser.acquaintances');
        toUser.acquaintances.push(fromUser._id);
        await toUser.save();
        console.log('toUser updated');
      }
  
      console.log('Creating notification');
      const notification = new Notification({
        user: request.from,
        type: 'friend_request_accepted',
        message: `${toUser.name} accepted your friend request`,
        relatedId: request._id,
      });
      await notification.save();
      console.log('Notification created');
  
      console.log('Fetching updated user data');
      const user = await User.findById(req.userId)
        .select('-password')
        .populate('branch')
        .populate('skills')
        .populate('acquaintances', 'name email');
  
      console.log('Fetching pending requests');
      const pendingRequests = await Request.find({
        to: req.userId,
        status: 'pending'
      }).populate('from', 'name email');
  
      console.log('Sending response');
      res.json({ ...user.toObject(), pendingRequests });
    } catch (err) {
      console.error('Error in /requests/:id/accept:', err);
      res.status(500).json({ message: err.message });
    }
  });

// Decline a friend request
router.put('/requests/:id/decline', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    if (request.to.toString() !== req.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    request.status = 'declined';
    await request.save();

    const toUser = await User.findById(req.userId);
    const notification = new Notification({
      user: request.from,
      type: 'friend_request_declined',
      message: `${toUser.name} declined your friend request`,
      relatedId: request._id,
    });
    await notification.save();

    const user = await User.findById(req.userId)
      .select('-password')
      .populate('branch')
      .populate('skills')
      .populate('acquaintances', 'name email');

    const pendingRequests = await Request.find({
      to: req.userId,
      status: 'pending'
    }).populate('from', 'name email');

    res.json({ ...user.toObject(), pendingRequests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get sent (outgoing) requests
router.get('/requests/sent', auth, async (req, res) => {
  try {
    const sentRequests = await Request.find({
      from: req.userId,
      status: 'pending'
    }).populate('to', 'name email');
    res.json(sentRequests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a user's profile by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('branch')
      .populate('skills')
      .populate('acquaintances', 'name email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all users (for testing)
router.get('/', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/recommendations', auth, async (req, res) => {
    try {
      const user = await User.findById(req.userId).populate('acquaintances');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Recommend users based on branch, skills, or mutual acquaintances
      const recommendedUsers = await User.find({
        $and: [
          { _id: { $ne: req.userId } }, // Exclude the current user
          { _id: { $nin: user.acquaintances.map(a => a._id) } }, // Exclude current acquaintances
          {
            $or: [
              { branch: user.branch },
              { skills: { $in: user.skills } },
              { acquaintances: { $in: user.acquaintances.map(a => a._id) } },
            ],
          },
        ],
      }).select('name email branch skills bio').limit(5);
  
      res.json(recommendedUsers);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

module.exports = router;