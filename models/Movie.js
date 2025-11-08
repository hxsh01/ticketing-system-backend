const mongoose = require('mongoose');
const ShowSchema = new mongoose.Schema({
  title: String,
  seats: [{
    row: String,
    number: Number,
    isBooked: { type: Boolean, default: false },
    isReserved: { type: Boolean, default: false },
    reservedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reservedUntil: { type: Date, default: null }
  }]
});
module.exports = mongoose.model('Movie', ShowSchema);
