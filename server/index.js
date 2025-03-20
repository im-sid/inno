const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const User = require('./models/User');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications')(io));
app.use('/api/search', require('./routes/search')); // Add the search route

// Socket.IO and other existing code...
// Socket.IO connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('sendMessage', async (data) => {
    console.log('Received sendMessage:', data);
    const { senderId, receiverId, content } = data;
    try {
      const message = new Message({
        sender: senderId,
        receiver: receiverId,
        content,
      });
      await message.save();
      console.log('Message saved:', message);

      const sender = await User.findById(senderId);
      if (!sender) {
        throw new Error('Sender not found');
      }

      io.to(senderId).to(receiverId).emit('receiveMessage', {
        ...message.toObject(),
        sender: senderId,
        receiver: receiverId,
      });

      const notification = new Notification({
        user: receiverId,
        type: 'new_message',
        message: `New message from ${sender.name}`,
        relatedId: senderId,
      });
      await notification.save();
      console.log('Notification saved:', notification);

      io.to(receiverId).emit('newNotification', notification);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Watch for changes in the notifications collection
const notificationChangeStream = Notification.watch();
notificationChangeStream.on('change', (change) => {
  if (change.operationType === 'delete') {
    const deletedNotificationId = change.documentKey._id;
    // Fetch the notification to get the user ID (if needed)
    // Since the document is deleted, we might need to store the user ID in the change stream pipeline
    // For simplicity, we'll assume the frontend will handle the removal
    io.emit('notificationDeleted', { notificationId: deletedNotificationId });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));