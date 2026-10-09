// Puts the game together: joins the parts in src/ into the one file you play, index.html.
// Run it after changing anything in src/:
//
//   node build.js
//
const fs = require('fs');
const path = require('path');
const read = name => fs.readFileSync(path.join(__dirname, 'src', name), 'utf8');

// The script parts, in the order they must appear (each one uses what the earlier ones define).
const PARTS = ['10-sim.js', '20-levels.js', '30-art.js', '32-tiles.js', '34-font.js', '40-render.js', '50-audio.js', '60-game.js'];

const script =
  '<script>\n' +
  read('05-contents.js') +
  '(function () {\n' +
  '"use strict";\n' +
  PARTS.map(read).join('') +
  '})();\n' +
  '</script>\n';

// 00-page.html holds the title, fonts and styles first, then the visible page.
// Everything up to the end of the styles belongs in <head>, the rest in <body>.
const page = read('00-page.html');
const end = /^<\/style>\r?\n/m.exec(page);
if (!end) throw new Error('src/00-page.html: no line starting with </style> found');
const cut = end.index + end[0].length;

const html =
  '<!doctype html>\n' +
  '<html lang="en">\n' +
  '<head>\n' +
  '<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}img{max-width:100%}</style>\n' +
  page.slice(0, cut) +
  '</head>\n' +
  '<body>\n' +
  page.slice(cut) +
  script +
  '</body>\n' +
  '</html>\n';

const out = path.join(__dirname, 'index.html');
fs.writeFileSync(out, html);
console.log('built index.html (' + Math.round(Buffer.byteLength(html) / 1024) + ' KB)');
