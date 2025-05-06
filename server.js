const dotenv = require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const http = require('http');
const { Server } = require('socket.io');

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

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected to freelancehub'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join_project', (projectId) => {
    socket.join(projectId);
    console.log(`User joined project room: ${projectId}`);
  });

  socket.on('send_message', async ({ projectId, senderId, message }) => {
    try {
      const Message = require('./models/Message');
      const newMessage = new Message({
        project: projectId,
        sender: senderId,
        content: message,
      });
      await newMessage.save();
      io.to(projectId).emit('receive_message', {
        _id: newMessage._id,
        project: projectId,
        sender: senderId,
        content: message,
        createdAt: newMessage.createdAt,
      });
      console.log(`Message sent to project ${projectId}:`, message);
    } catch (error) {
      console.error('Send message error:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));