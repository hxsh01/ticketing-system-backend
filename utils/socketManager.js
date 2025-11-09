const Movie = require("../models/Movie");

const RES_MS = parseInt(process.env.RESERVATION_MS || "60000", 10);
let ioInstance = null;

// Map to debounce emits per movie
const emitQueue = new Map();

/**
 * Initialize socket.io for real-time movie updates.
 */
function initializeSockets(io) {
  ioInstance = io;

  io.on("connection", (socket) => {
    console.log("🔌 User connected:", socket.id);

    socket.on("join-movie", ({ movieId }) => {
      socket.join(`movie:${movieId}`);
      console.log(`📽️ ${socket.id} joined room movie:${movieId}`);
    });

    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);
    });
  });
}

/**
 * Debounced emit of movie updates to clients.
 */
async function emitMovieUpdate(movieId) {
  if (!ioInstance) return;

  // Prevent flooding by debouncing emits per movie
  if (emitQueue.has(movieId)) return;

  const timeout = setTimeout(async () => {
    emitQueue.delete(movieId);
    const movie = await Movie.findById(movieId).lean();
    if (movie) {
      ioInstance.to(`movie:${movieId}`).emit("movie:update", movie);
      console.log(`📡 Emitted movie:update for ${movieId}`);
    }
  }, 500); // 0.5s debounce window

  emitQueue.set(movieId, timeout);
}

/**
 * Reserve seats for a user for a limited time.
 */
async function reserveSeats(userId, movieId, seatIds) {
  const movie = await Movie.findById(movieId);
  if (!movie) throw new Error("Movie not found");

  const now = new Date();

  for (const sid of seatIds) {
    const seat = movie.seats.id(sid);
    if (!seat) throw new Error("Invalid seat ID");
    if (seat.isBooked) throw new Error("Seat already booked");

    if (
      seat.isReserved &&
      seat.reservedBy &&
      seat.reservedBy.toString() !== userId &&
      seat.reservedUntil &&
      new Date(seat.reservedUntil) > now
    ) {
      throw new Error("Seat already reserved by another user");
    }
  }

  const reservedUntil = new Date(Date.now() + RES_MS);
  for (const sid of seatIds) {
    const seat = movie.seats.id(sid);
    seat.isReserved = true;
    seat.reservedBy = userId;
    seat.reservedUntil = reservedUntil;
  }

  await movie.save();

  // Auto-release after expiration
  setTimeout(async () => {
    const m = await Movie.findById(movieId);
    const now2 = new Date();
    let changed = false;

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
        changed = true;
      }
    }

    if (changed) {
      await m.save();
      emitMovieUpdate(movieId);
    }
  }, RES_MS + 200);

  emitMovieUpdate(movieId);
  return { reservedUntil };
}

/**
 * Confirm (book) reserved seats.
 */
async function bookSeats(userId, movieId, seatIds) {
  const movie = await Movie.findById(movieId);
  if (!movie) throw new Error("Movie not found");

  const now = new Date();

  for (const sid of seatIds) {
    const seat = movie.seats.id(sid);
    if (!seat) throw new Error("Invalid seat ID");
    if (seat.isBooked) throw new Error("Seat already booked");

    if (
      !seat.isReserved ||
      !seat.reservedBy ||
      seat.reservedBy.toString() !== userId ||
      (seat.reservedUntil && new Date(seat.reservedUntil) <= now)
    ) {
      throw new Error("Seat not reserved by you or expired");
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
  emitMovieUpdate(movieId);
}

/**
 * Cancel reserved seats.
 */
async function cancelSeats(userId, movieId, seatIds) {
  const movie = await Movie.findById(movieId);
  if (!movie) throw new Error("Movie not found");

  let changed = false;
  for (const sid of seatIds) {
    const seat = movie.seats.id(sid);
    if (seat && seat.reservedBy && seat.reservedBy.toString() === userId) {
      seat.isReserved = false;
      seat.reservedBy = null;
      seat.reservedUntil = null;
      changed = true;
    }
  }

  if (changed) {
    await movie.save();
    emitMovieUpdate(movieId);
  }
}

module.exports = {
  initializeSockets,
  reserveSeats,
  bookSeats,
  cancelSeats,
  emitMovieUpdate,
};
