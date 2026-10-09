// Proves a stage can be finished. A search-based player (bot.js) looks for a way to the bell from the
// start and from every lamp, with no umbrella and without being hit once.
//
//   node test/solve.js                 all four stages
//   node test/solve.js 2               only the third stage (stages are numbered from 0 here)
//   node test/solve.js 2 140 norun     the same, never touching the run button
//
// The middle number is how many attempts the search keeps going at once: more is slower but more thorough.
require('./harness.js');
require('./bot.js');
const api = { TS, SOLID, newSim, cloneSim, step };
const which = process.argv[2] != null ? [+process.argv[2]] : [0, 1, 2, 3];
const beam = +process.argv[3] || 140, noRun = process.argv[4] === 'norun';
let failed = 0;
for (const li of which) {
  for (let fromCp = 0; fromCp <= LEVELS[li].cps.length; fromCp++) {
    const t0 = Date.now();
    const r = TobiBot.solve(LEVELS[li], api, { fromCp, beam, noRun, maxIter: 4000 });
    delete r.path;
    if (!r.ok) failed++;
    console.log((noRun ? 'WALK ONLY ' : '') + 'stage', li + 1, fromCp ? '(from lamp ' + fromCp + ')' : '(from start)', JSON.stringify(r), ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
}
process.exit(failed ? 1 : 0);
