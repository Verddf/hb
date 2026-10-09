// The slow proofs, all in one go (allow 10 to 20 minutes).
// A search-based player (bot.js) shows that every stage can be finished from the start and from every lamp,
// with and without the run button, and that every sun shard can be collected.
//
//   node test/prove.js
//
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const jobs = [];
for (let li = 0; li < 4; li++) {
  jobs.push({ name: 'stage ' + (li + 1) + ' can be finished', args: ['solve.js', li] });
  jobs.push({ name: 'stage ' + (li + 1) + ' can be finished without the run button', args: ['solve.js', li, 140, 'norun'] });
  jobs.push({ name: 'stage ' + (li + 1) + ': every shard can be collected', args: ['gems.js', li] });
}

// as many searches at a time as the computer has processors
const limit = Math.max(1, os.availableParallelism ? os.availableParallelism() : os.cpus().length);
const t0 = Date.now();
let next = 0, running = 0, finished = 0, failed = 0;

function launch() {
  while (running < limit && next < jobs.length) {
    const job = jobs[next++];
    let out = '';
    const child = spawn(process.execPath, [path.join(__dirname, job.args[0])].concat(job.args.slice(1).map(String)));
    running++;
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('close', code => {
      running--; finished++;
      if (code !== 0) failed++;
      console.log((code === 0 ? 'ok      ' : 'FAILED  ') + job.name);
      out.trim().split('\n').forEach(line => console.log('          ' + line));
      if (finished < jobs.length) return launch();
      const mins = ((Date.now() - t0) / 60000).toFixed(1);
      console.log(failed ? failed + ' of ' + jobs.length + ' PROOFS FAILED (' + mins + ' min)' : 'all ' + jobs.length + ' proofs passed (' + mins + ' min)');
      process.exit(failed ? 1 : 0);
    });
  }
}

console.log('running ' + jobs.length + ' searches, ' + limit + ' at a time...');
launch();
