const Movie = require('../models/Movie');
const RES_MS = parseInt(process.env.RESERVATION_MS || '60000', 10);
let ioInstance = null;
function initializeSockets(io){
  ioInstance = io;
  io.on('connection', socket => {
    socket.on('join-movie', ({ movieId }) => { socket.join('movie:'+movieId); });
  });
}
async function emitMovieUpdate(movieId){
  if (!ioInstance) return;
  const movie = await Movie.findById(movieId).lean();
  ioInstance.to('movie:'+movieId).emit('movie:update', movie);
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

    // If reserved by another user and still valid -> cannot reserve
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

  // Apply reservation or extend existing ones
  for (const sid of seatIds) {
    const seat = movie.seats.id(sid);

    // If the same user already reserved it, just extend time
    if (
      seat.isReserved &&
      seat.reservedBy &&
      seat.reservedBy.toString() === userId
    ) {
      seat.reservedUntil = reservedUntil;
    } else {
      // Otherwise create a new reservation
      seat.isReserved = true;
      seat.reservedBy = userId;
      seat.reservedUntil = reservedUntil;
    }
    changed = true;
  }

  if (changed) await movie.save();

  // Schedule cleanup after timeout
  setTimeout(async () => {
    const m = await Movie.findById(movieId);
    const now2 = new Date();
    let changed2 = false;

    for (const s of m.seats) {
      if (
        s.isReserved &&
        !s.isBooked &&
        s.reservedUntil &&
        new Date(s.reservedUntil) <= now2
      ) {
        s.isReserved = false;
        s.reservedBy = null;
        s.reservedUntil = null;
        changed2 = true;
      }
    }

    if (changed2) {
      await m.save();
      emitMovieUpdate(movieId);
    }
  }, RES_MS + 50);

  await emitMovieUpdate(movieId);
  return { reservedUntil };
}

async function bookSeats(userId, movieId, seatIds){
  const movie = await Movie.findById(movieId);
  const now = new Date();
  for (const sid of seatIds){
    const seat = movie.seats.id(sid);
    if (!seat) throw new Error('seat id invalid');
    if (seat.isBooked) throw new Error('already booked');
    if (!seat.isReserved || !seat.reservedBy || seat.reservedBy.toString() !== userId || (seat.reservedUntil && new Date(seat.reservedUntil) <= now)) {
      throw new Error('seat not reserved by you or expired');
    }
  }
  for (const sid of seatIds){
    const seat = movie.seats.id(sid);
    seat.isBooked = true; seat.isReserved = false; seat.reservedBy = null; seat.reservedUntil = null;
  }
  await movie.save();
  await emitMovieUpdate(movieId);
}
async function cancelSeats(userId, movieId, seatIds){
  const movie = await Movie.findById(movieId);
  for (const sid of seatIds){
    const seat = movie.seats.id(sid);
    if (seat && seat.reservedBy && seat.reservedBy.toString() === userId){
      seat.isReserved = false; seat.reservedBy = null; seat.reservedUntil = null;
    }
  }
  await movie.save();
  await emitMovieUpdate(movieId);
}
module.exports = { initializeSockets, reserveSeats, bookSeats, cancelSeats, emitMovieUpdate };
