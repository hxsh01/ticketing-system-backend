const Movie = require('../models/Movie');
const RES_MS = parseInt(process.env.RESERVATION_MS || '60000', 10);
let ioInstance = null;
// Map userId -> Set of active socket IDs
const userSockets = new Map();

function initializeSockets(io) {
  ioInstance = io;

  io.on('connection', socket => {
    // when user joins a movie room
    socket.on('join-movie', ({ movieId }) => {
      socket.join('movie:' + movieId);
    });

    // register user for direct notifications
    socket.on('register-user', ({ userId }) => {
      if (!userId) return;
      if (!userSockets.has(userId)) userSockets.set(userId, new Set());
      userSockets.get(userId).add(socket.id);
    });

    socket.on('disconnect', () => {
      for (const [uid, sockets] of userSockets.entries()) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSockets.delete(uid);
      }
    });
  });
}

async function emitMovieUpdate(movieId) {
  if (!ioInstance) return;
  const movie = await Movie.findById(movieId).lean();
  ioInstance.to('movie:' + movieId).emit('movie:update', movie);
  ioInstance.emit('movie:update', movie);
}

async function reserveSeats(userId, movieId, seatIds) {
  const movie = await Movie.findById(movieId);
  if (!movie) throw new Error('movie not found');

  const now = new Date();

  // Validate seat availability
  for (const sid of seatIds) {
    const seat = movie.seats.id(sid);
    if (!seat) throw new Error('seat id invalid');
    if (seat.isBooked) throw new Error('already booked');
    if (
      seat.isReserved &&
      seat.reservedBy &&
      seat.reservedBy.toString() !== userId &&
      seat.reservedUntil &&
      new Date(seat.reservedUntil) > now
    ) {
      throw new Error('seat reserved by someone else');
    }
  }

  const reservedUntil = new Date(Date.now() + RES_MS);
  let changed = false;

  // Apply or extend reservation
  for (const sid of seatIds) {
    const seat = movie.seats.id(sid);

    if (
      seat.isReserved &&
      seat.reservedBy &&
      seat.reservedBy.toString() === userId
    ) {
      seat.reservedUntil = reservedUntil;
    } else {
      seat.isReserved = true;
      seat.reservedBy = userId;
      seat.reservedUntil = reservedUntil;
    }
    changed = true;
  }

  if (changed) await movie.save();

  // Schedule cleanup and emit notification
  setTimeout(async () => {
    const m = await Movie.findById(movieId);
    const now2 = new Date();
    let changed2 = false;

    // Track released seats by user
    const expiredByUser = {};

    for (const s of m.seats) {
      if (
        s.isReserved &&
        !s.isBooked &&
        s.reservedUntil &&
        new Date(s.reservedUntil) <= now2
      ) {
        const uid = s.reservedBy?.toString();
        if (uid) {
          if (!expiredByUser[uid]) expiredByUser[uid] = [];
          expiredByUser[uid].push(s._id.toString());
        }
        s.isReserved = false;
        s.reservedBy = null;
        s.reservedUntil = null;
        changed2 = true;
      }
    }

    if (changed2) {
      await m.save();
      emitMovieUpdate(movieId);

      // 🔔 Notify users whose reservations expired
      for (const [uid, seatIds] of Object.entries(expiredByUser)) {
        const sockets = userSockets.get(uid);
        if (sockets && ioInstance) {
          for (const sid of sockets) {
            ioInstance.to(sid).emit('reservation:expired', {
              movieId,
              seatIds,
            });
          }
        }
      }
    }
  }, RES_MS + 50);

  await emitMovieUpdate(movieId);
  return { reservedUntil };
}

async function bookSeats(userId, movieId, seatIds) {
  const movie = await Movie.findById(movieId);
  const now = new Date();

  for (const sid of seatIds) {
    const seat = movie.seats.id(sid);
    if (!seat) throw new Error('seat id invalid');
    if (seat.isBooked) throw new Error('already booked');
    if (
      !seat.isReserved ||
      !seat.reservedBy ||
      seat.reservedBy.toString() !== userId ||
      (seat.reservedUntil && new Date(seat.reservedUntil) <= now)
    ) {
      throw new Error('seat not reserved by you or expired');
    }
  }

  for (const sid of seatIds) {
    const seat = movie.seats.id(sid);
    seat.isBooked = true;
    seat.isReserved = false;
    seat.reservedBy = null;
    seat.reservedUntil = null;
  }

  await movie.save();
  await emitMovieUpdate(movieId);
}

async function cancelSeats(userId, movieId, seatIds) {
  const movie = await Movie.findById(movieId);
  for (const sid of seatIds) {
    const seat = movie.seats.id(sid);
    if (seat && seat.reservedBy && seat.reservedBy.toString() === userId) {
      seat.isReserved = false;
      seat.reservedBy = null;
      seat.reservedUntil = null;
    }
  }
  await movie.save();
  await emitMovieUpdate(movieId);
}

module.exports = {
  initializeSockets,
  reserveSeats,
  bookSeats,
  cancelSeats,
  emitMovieUpdate,
};
