const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const { requireAuth } = require('../middlewares/authMiddleware');
router.get('/', requireAuth, async (req,res)=>{
  const movies = await Movie.find().select('_id title').lean();
  res.json(movies);
});
router.get('/:id', requireAuth, async (req,res)=>{
  const m = await Movie.findById(req.params.id).lean();
  if (!m) return res.status(404).json({ error: 'not found' });
  res.json(m);
});
module.exports = router;
