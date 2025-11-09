const Movie = require('../models/Movie');
module.exports = async function seed(){
  const count = await Movie.countDocuments();
  if (count > 0) return;
  const movies = [
    { title: 'Avengers: Endgame' }
  ];
  const rows = 'ABCDEFGH'.split('');
  for (const m of movies){
    const seats = [];
    for (const r of rows){
      for (let c=1;c<=8;c++){ seats.push({ row: r, number: c }); }
    }
    await Movie.create({ title: m.title, seats });
  }
  console.log('Seeded 2 movies');
}
