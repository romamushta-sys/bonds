// © 2026 Мушта Роман Александрович. Запускает все тесты страницы и считает провалы.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const files = fs.readdirSync(__dirname).filter(f => /^t\d+-.*\.js$/.test(f)).sort();
let bad = 0, total = 0;
for (const f of files) {
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 120000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const pass = (out.match(/^PASS/gm) || []).length, fail = (out.match(/^(FAIL|ERR)/gm) || []).length + (r.status ? 1 : 0);
  total += pass; bad += fail;
  console.log((fail ? 'FAIL ' : 'ok   ') + f + ': ' + pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
  if (fail) console.log(out.split('\n').filter(l => /^(FAIL|ERR)|Error|at /.test(l)).slice(0, 12).join('\n'));
}
console.log('\n' + total + ' checks passed, ' + bad + ' failed');
process.exit(bad ? 1 : 0);
