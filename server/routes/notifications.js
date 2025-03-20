const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// Pass the io instance to the router
module.exports = (io) => {
  // Get all notifications for the user
  router.get('/', auth, async (req, res) => {
    try {
      const notifications = await Notification.find({ user: req.userId })
        .sort({ createdAt: -1 });
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get unread notification count
  router.get('/unread-count', auth, async (req, res) => {
    try {
      const count = await Notification.countDocuments({ user: req.userId, read: false });
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Mark a notification as read
  router.put('/:id/read', auth, async (req, res) => {
    try {
      const notification = await Notification.findById(req.params.id);
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      if (notification.user.toString() !== req.userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      notification.read = true;
      await notification.save();

      // Emit a notificationRead event to the user's room
      io.to(req.userId).emit('notificationRead', { notificationId: notification._id });

      res.json(notification);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return router;
};