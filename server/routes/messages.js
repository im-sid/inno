const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get list of acquaintances with latest message
router.get('/conversations', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('acquaintances', 'name email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const conversations = await Promise.all(
      user.acquaintances.map(async (acquaintance) => {
        const latestMessage = await Message.findOne({
          $or: [
            { sender: req.userId, receiver: acquaintance._id },
            { sender: acquaintance._id, receiver: req.userId },
          ],
        })
          .sort({ createdAt: -1 })
          .populate('sender receiver', 'name');

        return {
          acquaintance,
          latestMessage: latestMessage
            ? {
                content: latestMessage.content,
                createdAt: latestMessage.createdAt,
                sender: latestMessage.sender.name,
              }
            : null,
        };
      })
    );
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get message history with a specific user
router.get('/history/:userId', auth, async (req, res) => {
  try {
    console.log('Fetching message history for userId:', req.userId, 'with user:', req.params.userId);
    const messages = await Message.find({
      $or: [
        { sender: req.userId, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.userId },
      ],
    }).sort({ createdAt: 1 });

    console.log('Messages found:', messages);
    const messagesWithSenderFlag = messages.map(message => ({
      ...message.toObject(),
      isSentByMe: message.sender.toString() === req.userId,
    }));

    res.json(messagesWithSenderFlag);
  } catch (err) {
    console.error('Error fetching message history:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;