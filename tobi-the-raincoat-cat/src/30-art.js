/* ============================================================
   PIXEL ART
   Every sprite is drawn here as a small grid of letters, one
   letter per pixel, and turned into an image when the page loads.
   No image files are used.
   ============================================================ */

const PAL = {
  k: '#1b1b2f', K: '#3a3f5c', s: '#6b7394', S: '#a9b4cc', w: '#ffffff', c: '#fff3d6',
  y: '#ffcf3f', Y: '#fff2a0', a: '#f09a2e', A: '#c2611f',
  r: '#e8414f', R: '#a3223e', p: '#ff9db0', P: '#d9668a',
  v: '#8a5cc4', V: '#573a8c', u: '#b99be8',
  b: '#4a9ff5', B: '#2a62c4', i: '#9fd8ff',
  t: '#35c9b6', T: '#1d8f8a',
  g: '#62d04e', G: '#2f9c4a', d: '#1d6a43', l: '#bdf06e',
  n: '#9a6238', N: '#64391f', o: '#dba06a', O: '#f4cfa0',
  e: '#ff7a2f', f: '#ffe14d',
};

function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Turn rows of letters into an image. '.' is see-through.
function art(rows, pal) {
  if (typeof rows === 'string') rows = rows.trim().split('\n').map(function (r) { return r.trim(); });
  const h = rows.length;
  let w = 0;
  for (let y = 0; y < h; y++) w = Math.max(w, rows[y].length);
  const c = mk(w, h), g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x];
    if (ch === '.' || ch === ' ') continue;
    const col = (pal && pal[ch]) || PAL[ch];
    if (!col) continue;
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
  return c;
}
function flipX(c) {
  const f = mk(c.width, c.height), g = f.getContext('2d');
  g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
  return f;
}
function flipY(c) {
  const f = mk(c.width, c.height), g = f.getContext('2d');
  g.translate(0, c.height); g.scale(1, -1); g.drawImage(c, 0, 0);
  return f;
}
function rows(str) { return str.trim().split('\n').map(function (r) { return r.trim(); }); }

const SPR = {};      // name -> image (facing right)
const SPRL = {};     // name -> mirrored image (facing left)
function def(name, r, pal) { SPR[name] = art(r, pal); SPRL[name] = flipX(SPR[name]); return SPR[name]; }

/* ---------- Tobi, the raincoat cat ---------- */

function buildHero(pre, pal) {
  // head: a hood with cat ears, the face showing on the right
  const HEAD = rows(`
    ...kk.....kk....
    ..kyyk...kyyk...
    ..kyYykkkyYyk...
    .kyyyyyyyyyyyk..
    .kyyyyyyyyyyyk..
    .kyyaOOOOOOOOk..
    .kyaccckcckcck..
    .kyaccckcckcck..
    .kaacccccpccck..
    ..kaakkkkkkkk...
  `);
  const eyes = function (r6, r7) { const h = HEAD.slice(); h[6] = r6; h[7] = r7; return h; };
  const BLINK = eyes('.kyaccccccccck..', '.kyacckkckkcck..');
  const HURT = eyes('.kyacckcccckck..', '.kyaccckcckcck..');
  const HAPPY = eyes('.kyaccckccckck..', '.kyacckckckckk..');
  const BODY = {
    idle: rows(`
      ..kyyyyyyyyk....
      .kkyyyaayyyk....
      kcckyyyyyyyk....
      kkkkykkkkyk.....
      ...kttk.kttk....
      ...kkkk.kkkk....
    `),
    run1: rows(`
      ..kyyyyyyyyk....
      .kkyyyyaayyk....
      kcckyyyyyyykk...
      kkkkkykkkkttk...
      .kttk....kkk....
      .kkk............
    `),
    run2: rows(`
      ..kyyyyyyyyk....
      .kkyyaayyyyk....
      kcckyyyyyyyk....
      kkkkkykkykk.....
      ....kttttk......
      ....kkkkkk......
    `),
    run3: rows(`
      ..kyyyyyyyyk....
      .kkyaayyyyyk....
      kcckyyyyyyyk....
      kkkttkkkkykk....
      ..kkk..kttk.....
      .......kkkk.....
    `),
    jump: rows(`
      .kkyyyyyyyykk...
      kcckyyyyyyyak...
      kkkkyyyyyyyk....
      ..kttkkkkyk.....
      ..kkk.kttk......
      ......kkk.......
    `),
    fall: rows(`
      .kkyyyyyyyyk....
      kckayyyyyyyak...
      kkkkyyyyyyykk...
      ..kkykkkkyk.....
      ..kttk..kttk....
      ..kkk....kkk....
    `),
    skid: rows(`
      ..kyyyyyyyyk....
      ..kyyyyaayykkk..
      .kkyyyyyyyykck..
      ..kkykkkkykkkk..
      .kttk.kttk......
      .kkkk.kkkk......
    `),
    cheer: rows(`
      ..kyyyyyyyykak..
      .kkyyyyyyyyak...
      kcckyyyyyyyk....
      kkkkykkkkyk.....
      ...kttk.kttk....
      ...kkkk.kkkk....
    `),
  };
  const fr = function (head, body) { return head.concat(body); };
  def(pre + '_idle', fr(HEAD, BODY.idle), pal);
  def(pre + '_blink', fr(BLINK, BODY.idle), pal);
  def(pre + '_run1', fr(HEAD, BODY.run1), pal);
  def(pre + '_run2', fr(HEAD, BODY.run2), pal);
  def(pre + '_run3', fr(HEAD, BODY.run3), pal);
  def(pre + '_jump', fr(HEAD, BODY.jump), pal);
  def(pre + '_fall', fr(HEAD, BODY.fall), pal);
  def(pre + '_skid', fr(HEAD, BODY.skid), pal);
  def(pre + '_hurt', fr(HURT, BODY.fall), pal);
  def(pre + '_cheer', fr(HAPPY, BODY.cheer), pal);
  if (pre !== 'tobi') return;
  // the umbrella: folded on the back, open overhead
  def('umb_folded', `
    ......kk
    .....krk
    ....krrk
    ...krRk.
    ..krRk..
    .kkkk...
    kok.....
    kk......
  `);
  def('umb_open', `
    .......kk.......
    ....kkkrrkkk....
    ..kkrrrrrRRRkk..
    .krrrrrrrRRRRRk.
    krrwrrrrrrRRRRRk
    krkkrrkkkrrkkkRk
    kk..kk.kok.kk.kk
    ........o.......
    ........o.......
  `);
}

/* ---------- creatures ---------- */

function buildCreatures() {
  // Grumble: a grumpy raindrop on legs
  const GR = rows(`
    .......kk.......
    ......kuuk......
    ......kuvk......
    .....kuvvvk.....
    ....kuvvvvvk....
    ...kuvvvvvvvk...
    ..kuvvvvvvvvvk..
    .kuvkkvvvvkkvvk.
    .kvvwwkvvkwwvvk.
    .kvvwkvvvvkwvvk.
    .kvvvvvvvvvvvVk.
    .kvvvvkkkkvvVVk.
    ..kVvkvvvvkVVk..
    ...kkVVVVVVkk...
  `);
  def('mud1', GR.concat(['..kaak....kaak..', '..kkkk....kkkk..']));
  def('mud2', GR.concat(['...kaak..kaak...', '...kkkk..kkkk...']));
  def('mud_flat', `
    ...kkkkkkkkkk...
    .kkuvvvvvvvvvkk.
    kvvkkwvvvvwkkvvk
    kVvvvvvvvvvvvvVk
    .kkkkkkkkkkkkkk.
  `);

  // Snail
  def('snail1', `
    ................
    ................
    ...........k..k.
    ...........p..p.
    ....kkkkk..p..p.
    ..kkTTTTTkkpppk.
    .kTTtttttTkpppk.
    .kTttTTTttkpkpk.
    kTttTtttTtkppppk
    kTtTttTttTkpppk.
    kTtTtTTtTtkppk..
    kTttTtttTtkppk..
    .kTttTTTttkppk..
    .kkTtttttkkPpk..
    kPpppppppppppk..
    .kkkkkkkkkkkk...
  `);
  def('snail2', `
    ................
    ................
    ............k..k
    ............p..p
    ....kkkkk...p..p
    ..kkTTTTTkk.pppk
    .kTTtttttTkkpppk
    .kTttTTTttkppkpk
    kTttTtttTtkppppk
    kTtTttTttTkpppk.
    kTtTtTTtTtkppk..
    kTttTtttTtkppk..
    .kTttTTTttkppk..
    .kkTtttttkPppk..
    .kPppppppppppk..
    ..kkkkkkkkkkk...
  `);
  def('shell', `
    ....kkkkk...
    ..kkTTTTTkk.
    .kTTtttttTk.
    .kTttTTTttTk
    kTttTtttTtTk
    kTtTttTttTtk
    kTtTtTTtTttk
    kTttTtttTtTk
    .kTttTTTttk.
    .kkTtttttkk.
    ...kkkkkk...
  `);

  // Prickle: do not jump on this one
  const PR = rows(`
    ...w...w...w....
    ..kwk.kwk.kwk...
    .kwSkkwSkkwSkk..
    kRRSRRRSRRRSRRk.
    kRrrrrrrrrrrrrrk
    kRrrrrrrrkkkrrrk
    kRrrrrrrrrwwkrrk
    kRrrrrrrrrwkkrpk
    kRRrrrrrrrrrrrrk
    .kRRRrrrrrrrrkk.
  `);
  def('prick1', PR.concat(['..kkakkkkkkakk..', '...kak....kak...', '...kkk....kkk...']));
  def('prick2', PR.concat(['..kkkakkkkakkk..', '....kak..kak....', '....kkk..kkk....']));

  // Flit: a cave bat
  def('bat1', `
    ....k......k....
    kk..kk....kk..kk
    kVk.kvkkkkvk.kVk
    kVVkkvvvvvvkkVVk
    kVVVkvwkkwvkVVVk
    kVkVkvvvvvvkVkVk
    .k.kkvkwwkvkk.k.
    ....kvvvvvvk....
    .....kkkkkk.....
  `);
  def('bat2', `
    ....k......k....
    ....kk....kk....
    ....kvkkkkvk....
    .kkkkvvvvvvkkkk.
    kVVVkvwkkwvkVVVk
    kVVVkvvvvvvkVVVk
    kVkVkvkwwkvkVkVk
    .k.kkvvvvvvkk.k.
    .....kkkkkk.....
  `);
  // Flit's fair-weather cousin: a sulky little storm cloud
  def('storm1', `
    ....kkk..kkk....
    ..kkSSSkkSSSkk..
    .kSSSSSSSSSSSSk.
    kSSssssssssssSSk
    kSsskksssskkssSk
    kSssfksssskfsssk
    kssssssssssssssk
    kKssssskkssssKKk
    .kKKssssssssKKk.
    ..kkKKKKKKKKkk..
    ....kkkkkkkk....
  `);
  def('storm2', `
    ...kkk....kkk...
    ..kSSSkkkkSSSk..
    .kSSSSSSSSSSSSk.
    kSSssssssssssSSk
    kSsskksssskkssSk
    kSssfksssskfsssk
    kssssssssssssssk
    kKssssskkssssKKk
    .kKKssssssssKKk.
    ..kkKKKKKKKKkk..
    ...kkkkkkkkkk...
  `);

  // Hopper
  def('frog1', `
    ...kk...kk......
    ..kwwk.kwwk.....
    ..kwkkkkwkkk....
    .kgggggggggggk..
    kgggggggggggggk.
    kgglllllgggkkgk.
    kgllllllllgggk..
    kgkllllllgkkgk..
    kggkkllkkgggk...
    kgggkkkkgggkk...
    .kkkk..kkkk.....
  `);
  def('frog2', `
    .........kk..kk.
    ........kwwkkwwk
    .......kkwkggwkk
    .....kkggggggggk
    ...kkggglllgkkgk
    ..kggggllllgggk.
    .kggkgllllgkkk..
    kggkkkgggkk.....
    kgk..kkkk.......
    .k..............
  `);

  // Ember: leaps out of lava
  def('ember1', `
    .....RR.....
    ....ReeR....
    ....RefR....
    ...ReffeR...
    ..ReeffeeR..
    .ReefffeeeR.
    .ReffffffeR.
    ReefkffkfeeR
    ReeffffffeeR
    ReefffffeeeR
    .ReefffeeeR.
    .ReeeeeeeeR.
    ..RReeeeRR..
    ....RRRR....
  `);
  def('ember2', `
    ......RR....
    .....ReR....
    ....ReeR....
    ...ReffeR...
    ..ReeffeeR..
    .ReeeffeeeR.
    .ReffffffeR.
    ReefkffkfeeR
    ReeffffffeeR
    ReeeffffeeeR
    .ReefffeeeR.
    .ReeeeeeeeR.
    ..RReeeeRR..
    ....RRRR....
  `);
  def('fire1', `
    ..RRRR..
    .ReeeeR.
    ReeffeeR
    ReffwfeR
    ReffffeR
    ReeffeeR
    .ReeeeR.
    ..RRRR..
  `);
  def('fire2', `
    ..RRRR..
    .ReeeeR.
    ReefeeeR
    ReffffeR
    ReewffeR
    ReeffeeR
    .ReeeeR.
    ..RRRR..
  `);
}

/* ---------- things to collect and things to use ---------- */

function buildItems() {
  def('coin0', `
    ..kkkkkk..
    .kYYYYyyk.
    kYyyyyyyak
    kYyyaayyak
    kYyaYYayak
    kYyaYYayak
    kYyyaayyak
    kYyyyyyyak
    kyyyyyyaak
    .kyyaaaak.
    ..kkkkkk..
  `);
  def('coin1', `
    ...kkkk...
    ..kYYyyk..
    ..kYyyak..
    ..kYyaak..
    ..kYaYak..
    ..kYaYak..
    ..kYyaak..
    ..kYyyak..
    ..kyyyak..
    ..kyaaak..
    ...kkkk...
  `);
  def('coin2', `
    ....kk....
    ...kYak...
    ...kYak...
    ...kYak...
    ...kYak...
    ...kYak...
    ...kYak...
    ...kYak...
    ...kYak...
    ...kyak...
    ....kk....
  `);
  def('gem', `
    ....kk....
    ...kYYk...
    ..kYwYyk..
    ..kYYyyk..
    .kYYyyyak.
    .kYyyyaak.
    kYyyyyaaAk
    .kyyyaaAk.
    .kyyaaAAk.
    ..kyaaAk..
    ...kaAk...
    ....kk....
  `);
  def('gem_off', `
    ....kk....
    ...kKKk...
    ..kKKKKk..
    ..kKKKKk..
    .kKKKKKKk.
    .kKKKKKKk.
    kKKKKKKKKk
    .kKKKKKKk.
    .kKKKKKKk.
    ..kKKKKk..
    ...kKKk...
    ....kk....
  `);
  def('sun1', `
    .....aa.....
    .a...yy...a.
    ..y.kkkk.y..
    ...kyyyyk...
    ..kyYYyyyk..
    aykYkyykyaya
    aykYyyyyyaya
    ..kykyykyak.
    ...kykkyak..
    ..y.kkkk.y..
    .a...yy...a.
    .....aa.....
  `);
  def('sun2', `
    .....yy.....
    .y...aa...y.
    ..a.kkkk.a..
    ...kyyyyk...
    ..kyYYyyyk..
    yakYkyykyaay
    yakYyyyyyaay
    ..kykyykyak.
    ...kykkyak..
    ..a.kkkk.a..
    .y...aa...y.
    .....yy.....
  `);
  def('heart', `
    ..kkk..kkk..
    .krrrkkrrrk.
    krwwrrrrrrRk
    krwrrrrrrrRk
    krrrrrrrrrRk
    krrrrrrrrRRk
    .krrrrrrRRk.
    ..krrrrRRk..
    ...krrRRk...
    ....krRk....
    .....kk.....
  `);
  def('item_umb', `
    ......kk......
    ...kkkrrkkk...
    .kkrrrrrrRRkk.
    krrrrrrrrrRRRk
    krwwrrrrrrRRRk
    krkkrrkkrrkkRk
    kk..kkokkk..kk
    ......ok......
    ......ok......
    ......ok......
    ......ok......
    ...kk.ok......
    ...kokok......
    ....kkk.......
  `);
  def('spring1', `
    kkkkkkkkkkkkkk
    krwwrrrrrrrRRk
    kkkkkkkkkkkkkk
    ..kSSSSSSSSk..
    ...kkkkkSSk...
    ..kSSSSSSSSk..
    ..kSSkkkkk....
    ..kSSSSSSSSk..
    .kkkkkkkkkkkk.
    .kKKKKKKKKKKk.
  `);
  def('spring2', `
    ..............
    ..............
    ..............
    ..............
    kkkkkkkkkkkkkk
    krwwrrrrrrrRRk
    kkkkkkkkkkkkkk
    ..kSSSSSSSSk..
    .kkkkkkkkkkkk.
    .kKKKKKKKKKKk.
  `);
  // halfway lamp, unlit and lit
  const lampHead = rows(`
    ....kkkk....
    ...kKKKKk...
    ..kkkkkkkk..
    ..kGGGGGGk..
    ..kGwGGGGk..
    ..kGGGGGGk..
    ..kGGGGGgk..
    ..kkkkkkkk..
    ...kKKKKk...
    ....kKKk....
  `);
  const post = [];
  for (let i = 0; i < 15; i++) post.push('.....kKk....');
  const lamp = lampHead.concat(post, ['....kKKk....', '...kKKKKk...', '..kkkkkkkk..']);
  def('lamp_off', lamp, { G: '#8892b0', g: '#6b7394', w: '#c5cde0', K: '#7b84a6' });
  def('lamp_on', lamp, { G: '#fff2a0', g: '#ffcf3f', w: '#ffffff', K: '#7b84a6' });
  def('bell', `
    .....kkkk.....
    ....kyyyyk....
    ...kyYYyyak...
    ...kyYyyyak...
    ..kyYyyyyyak..
    ..kyYyyyyyak..
    ..kyYyyyyyak..
    .kyYyyyyyyaak.
    .kyYyyyyyyaak.
    kyyyyyyyyyyaak
    kkkkkkkkkkkkkk
    .....kaak.....
    .....kaak.....
    ......kk......
  `);
  // small symbols for the score bar
  def('i_coin', `
    .kkkkk.
    kyYYyak
    kyYyyak
    kyYyyak
    kyYyyak
    kyyyaak
    .kkkkk.
  `);
  def('i_gem', `
    ...k...
    ..kYk..
    .kYyak.
    kYyyaAk
    .kyaAk.
    ..kAk..
    ...k...
  `);
  def('i_gem_off', `
    ...k...
    ..kKk..
    .kKKKk.
    kKKKKKk
    .kKKKk.
    ..kKk..
    ...k...
  `);
  def('i_clock', `
    .kkkkk.
    kwwkwwk
    kwwkwwk
    kwwkkwk
    kwwwwwk
    kwwwwwk
    .kkkkk.
  `);
  def('i_umb', `
    ...k...
    .kkrkk.
    krrrrRk
    kkkokkk
    ...o...
    .k.o...
    .kok...
  `);
}

function buildArt() {
  buildHero('tobi', null);
  buildHero('tobs', { y: '#ffffff', Y: '#ffffff', a: '#ffe14d' });   // glowing, while the sun drop lasts
  buildCreatures();
  buildItems();
  buildDecor();
  buildTiles();
  buildBackdrops();
}
