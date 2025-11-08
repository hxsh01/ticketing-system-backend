const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const { reserveSeats, bookSeats, cancelSeats } = require('../utils/socketManager');
router.post('/reserve', requireAuth, async (req,res)=>{
  try { const { movieId, seatIds } = req.body; const result = await reserveSeats(req.user._id.toString(), movieId, seatIds); res.json(result); } catch (err) { res.status(400).json({ error: err.message }); }
});
router.post('/book', requireAuth, async (req,res)=>{
  try { const { movieId, seatIds } = req.body; await bookSeats(req.user._id.toString(), movieId, seatIds); res.json({ ok: true }); } catch (err) { res.status(400).json({ error: err.message }); }
});
router.post('/cancel', requireAuth, async (req,res)=>{
  try { const { movieId, seatIds } = req.body; await cancelSeats(req.user._id.toString(), movieId, seatIds); res.json({ ok: true }); } catch (err) { res.status(400).json({ error: err.message }); }
});
router.get('/pending', requireAuth, async (req,res)=>{
  const Movie = require('../models/Movie');
  const movies = await Movie.find({ 'seats.reservedBy': req.user._id }).lean();
  const pending = []; const now = new Date();
  for (const m of movies){
    const seats = m.seats.filter(s => s.reservedBy && s.reservedBy.toString() === req.user._id.toString() && s.reservedUntil && new Date(s.reservedUntil) > now);
    if (seats.length) pending.push({ movieId: m._id, title: m.title, seats });
  }
  res.json(pending);
});
module.exports = router;
