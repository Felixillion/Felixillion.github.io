// Golden-case checks for the Status Credits page: loads the page's own data and
// SC functions (no browser needed) and compares results with hand-checked answers
// from Qantas's official earning tables. Run: node tests/sc_golden.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'pages/status-credits.html'), 'utf8');
const net = JSON.parse(fs.readFileSync(path.join(root, '_data/qf_network.json'), 'utf8'));
const start = html.indexOf('const SC_TABLE'), end = html.indexOf('// ── State');
let code = html.slice(start, end).replace('{{ site.data.qf_network | jsonify }}', JSON.stringify(net))
  .replace('{{ site.data.airports | jsonify }}', fs.readFileSync(path.join(root, '_data/airports.json'), 'utf8'));
const api = new Function(code + '\nreturn {scForBand, bandFor, distMiles, INTL_ROUTES};')();
const sc = (a, b, f) => api.scForBand(api.bandFor(a, b), f);
// [from, to, fare, expected SC one-way] — expected values read straight off the official tables
const CASES = [
  ['SYD','MEL','FLEX',20], ['SYD','MEL','SAVER',10], ['SYD','BNE','FLEX',20], ['BNE','MEL','FLEX',30],
  ['SYD','PER','FLEX',40], ['SYD','PER','BUS',80], ['SYD','PER','BUSFLEX',95], ['MEL','ADL','SALE',10],
  ['SYD','CNS','FLEX',30], ['SYD','DRW','SAVER',20], ['MEL','HBA','FLEX',20], ['ADL','PER','FLEX',30],
  ['SYD','AKL','FLEX',40], ['SYD','AKL','SAVER',25], ['MEL','WLG','BUS',85],
  ['SYD','SIN','FLEX',60], ['SYD','HND','BUS',125], ['PER','DPS','SAVER',25], ['PER','DPS','FLEX',50],
  ['SYD','LAX','FLEX',90], ['SYD','JFK','FLEX',140], ['SYD','LHR','FLEX',140], ['PER','LHR','FLEX',120],
  ['SYD','DXB','SAVER',60], ['SYD','JNB','FLEX',80], ['SYD','DEL','FLEX',75],
  ['SYD','NAN','FLEX',40],   // generic table, 1,501–2,500 mi
  ['SYD','AKL','BUSSALE',80], ['SYD','ZQN','SALE',20], ['AKL','SYD','SAVER',25], ['CHC','MEL','BUS',85],
  ['PER','AKL','SAVER',35],  // Perth isn't in the Australia–NZ table: generic 2,501–3,500 mi band
  ['SYD','MEL','BUSSALE',40]
  ];
let bad = 0;
for (const [a, b, f, want] of CASES) {
  if (want === null) continue;
  const got = sc(a, b, f);
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} ${a}-${b} ${f}: page ${got}, official ${want} (${api.distMiles(a, b)} mi, ${api.bandFor(a, b)})`);
}
// Domestic routes close to a band edge (distance estimates could put them in the wrong band)
for (const r of net.routes.filter(r => !r.intl)) {   // trans-Tasman uses a route table, not distance bands
  const d = api.distMiles(r.a, r.b);
  for (const e of [750, 1500]) if (Math.abs(d - e) <= 30) console.log(`⚠️ ${r.a}-${r.b} is ${d} mi — within 30 mi of the ${e}-mile band edge; check on qantas.com`);
}
process.exit(bad ? 1 : 0);
