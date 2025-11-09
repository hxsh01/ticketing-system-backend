const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

async function requireAuth(req, res, next){
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) return res.status(401).json({ error: 'unauthorised' });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id).select('-passwordHash');
    if (!user) return res.status(401).json({ error: 'unauthorised' });
    req.user = user;
    next();
  } catch (err) { console.error(err); res.status(401).json({ error: 'unauthorised' }); }
}
module.exports = { requireAuth };
