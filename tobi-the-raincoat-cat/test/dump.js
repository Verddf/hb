// Prints a stage as a map made of letters. Handy when changing a level.
//
//   node test/dump.js 0            the whole first stage (stages are numbered from 0 here)
//   node test/dump.js 2 100 160    columns 100 to 160 of the third stage
//
//   # ground    B crate    ? sun block    u used block    X stone block    [] stump or pillar
//   = thin floor    _ bridge    ^ spikes    ~ water or lava    o coin
//   @ start    K lamp    | bell    G sun shard    S spring    P moving platform
//   m Grumble    s Snail    p Prickle    f Hopper    v Flit    e lava spark    * ember chain    C crusher
const { dump } = require('./harness.js');
const li = +process.argv[2] || 0, L = LEVELS[li];
const a = +process.argv[3] || 0, b = +process.argv[4] || L.W;
for (let x = a; x < b; x += 110) { console.log(dump(L, x, Math.min(b, x + 110))); console.log(); }
console.log(L.name, 'W', L.W, 'H', L.H, 'ents', L.ents.length, 'gems', L.gemN, 'coins', L.grid.reduce((n, t) => n + (t === 9 ? 1 : 0), 0));
