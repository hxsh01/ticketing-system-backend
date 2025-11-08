const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const movieRoutes = require('./routes/movieRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const { initializeSockets } = require('./utils/socketManager');
const seedMovies = require('./utils/seedMovies');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/reservations', reservationRoutes);

const MONGO = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/moviebooking';
mongoose.connect(MONGO).then(async ()=>{
  console.log('Mongo connected');
  await seedMovies();
  initializeSockets(io);
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, ()=> console.log('Server listening on', PORT));
}).catch(err=>{ console.error('Mongo connect error', err); process.exit(1); });
