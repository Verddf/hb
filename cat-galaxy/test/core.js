// Loads the game's rules (the <script id="core"> part of index.html) into Node,
// so the checks run the exact code the browser runs.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const found = /^<script id="core">$([\s\S]*?)^<\/script>$/m.exec(html);
if (!found) throw new Error('index.html: no <script id="core"> found');

const context = vm.createContext({});
vm.runInContext(found[1], context, { filename: 'index.html (core)' });
module.exports = context.CatGalaxy;
