const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf-8');
}

// Flask serves frontend/src (templates + /static), nginx serves frontend/public;
// both copies must stay identical apart from the asset paths.
function toFlaskPaths(html) {
  return html
    .replace(/\/css\/styles\.css/g, '/static/styles.css')
    .replace(/\/js\/main\.js/g, '/static/main.js');
}

const pages = ['cadastro', 'login', 'conta_pendente', 'dashboard_gestao', 'dashboard_saude', 'recuperar_senha', 'redefinir_senha'];

for (const page of pages) {
  test(`src/templates/${page}.html mirrors public/${page}.html`, () => {
    assert.strictEqual(read(`src/templates/${page}.html`), toFlaskPaths(read(`public/${page}.html`)));
  });
}

test('src/static assets mirror public assets', () => {
  assert.strictEqual(read('src/static/main.js'), read('public/js/main.js'));
  assert.strictEqual(read('src/static/styles.css'), read('public/css/styles.css'));
});
