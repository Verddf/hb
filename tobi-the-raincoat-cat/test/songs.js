const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../src/50-audio.js', 'utf8');
const api = new Function('window', src + '\nreturn {SONGS, parseTrack, noteHz};')({});
let bad = 0;
for (const [name, s] of Object.entries(api.SONGS)) {
  if (name === 'title' || name === 'ending') continue;
  const lens = s.tracks.map(tr => { api.parseTrack(tr); return tr.len; });
  const max = Math.max(...lens);
  const ok = lens.every(l => max % l === 0) && (!s.loop || max % 16 === 0);
  // check every note parses to a sane frequency
  let nan = 0;
  s.tracks.forEach(tr => Object.values(tr.by).forEach(a => a.forEach(e => { if (tr.w !== 'drum' && !(e.hz > 40 && e.hz < 5000)) nan++; if (tr.w === 'drum' && !'ksh'.includes(e.n)) nan++; })));
  if (!ok || nan) bad++;
  console.log(name.padEnd(8), 'bpm', s.bpm, 'track lengths', lens.join(','), 'bars', (max / 16).toFixed(2), ok ? 'ok' : 'LENGTH MISMATCH', nan ? 'BAD NOTES ' + nan : '', (max * 15 / s.bpm).toFixed(1) + 's');
}
// bar-by-bar check for the lead of each looping song
for (const name of ['meadow', 'cave', 'sky', 'keep', 'sun']) {
  const s = api.SONGS[name];
  s.tracks.forEach((tr, ti) => {
    let at = 0, len = 2, lastBar = 0, okBars = true;
    tr.s.trim().split(/\s+/).forEach(tok => { const q = tok.split(':'); if (q[1]) len = +q[1]; const b0 = Math.floor(at / 16), b1 = Math.floor((at + len - 1) / 16); if (b0 !== b1) { okBars = false; console.log('  note crosses bar line in', name, 'track', ti, 'at step', at, tok); } at += len; });
  });
}
process.exit(bad ? 1 : 0);
