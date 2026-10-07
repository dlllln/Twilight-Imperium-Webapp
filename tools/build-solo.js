// Baut eine einzelne HTML-Datei, die das Spiel komplett im Browser gegen KI-Gegner laufen lässt.
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const mods = ['data', 'engine', 'bot', 'botrunner'].map((m) =>
  `__def('./${m}', function (module, exports, require) {\n${read('src/' + m + '.js')}\n});`).join('\n');
const loader = `const __mods = {}, __cache = {};
function __def(n, f) { __mods[n] = f; }
function require(n) { if (__cache[n]) return __cache[n].exports; const m = { exports: {} }; __cache[n] = m; __mods[n](m, m.exports, require); return m.exports; }`;
const css = read('public/style.css').replace(':root {', ':root {\n  color-scheme: dark;').replace('height: 100vh; }', 'height: 100%; }');
const out = `<title>Sternenthron</title>
<meta name="description" content="Strategiespiel um die Herrschaft über die Galaxis, gegen KI-Gegner im Browser.">
<style>
${css}
</style>
<div id="app"></div>
<div id="modal-root"></div>
<div id="toast"></div>
<script>
${loader}
${mods}
${read('tools/solo-socket.js')}
</script>
<script>
${read('public/app.js')}
</script>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/sternenthron-solo.html'), out);
console.log('dist/sternenthron-solo.html', out.length, 'Bytes');
