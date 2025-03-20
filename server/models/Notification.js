const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  message: { type: String, required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Add TTL index for automatic deletion
// Unread notifications expire after 7 days (7 * 24 * 60 * 60 seconds)
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { read: false } }
);

// Read notifications expire after 1 day (24 * 60 * 60 seconds)
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 24 * 60 * 60, partialFilterExpression: { read: true } }
);

module.exports = mongoose.model('Notification', notificationSchema);