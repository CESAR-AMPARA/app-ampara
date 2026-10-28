// Loads the real dashboard.html (with main.js inlined) in jsdom for the dashboard tests.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const mainJs = fs.readFileSync(path.join(root, 'public/js/main.js'), 'utf-8');
// jsdom does not fetch external scripts, so main.js is inlined in place of its <script src>.
// jsdom cannot navigate either, so redirects are captured in window.__mock_location_href.
const html = fs.readFileSync(path.join(root, 'public/dashboard.html'), 'utf-8')
  .replace('<script src="/js/main.js"></script>', () => '<script>' + mainJs + '</script>')
  .replace(/window\.location\.href\s*=\s*/g, 'window.__mock_location_href = ');

/**
 * routes maps "METHOD url" to a response ({ status, body }, or { fail: true } for a
 * network error) or to a list of responses consumed one per call; unknown requests
 * answer 200 with []. token: null opens the page without a session token.
 */
function loadDashboard({ usuario, routes = {}, token = 'jwt_test', storage = {} }) {
  const calls = [];
  const toasts = [];
  const dom = new JSDOM(html, {
    url: 'http://localhost/dashboard',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    // The legacy dashboard logs to the console when its own mocks differ; keep test output clean.
    virtualConsole: new VirtualConsole(),
    beforeParse(window) {
      window.scrollTo = () => {};
      window.Element.prototype.scrollIntoView = () => {};
      if (token) window.localStorage.setItem('token', token);
      Object.entries(storage).forEach(([key, value]) => window.localStorage.setItem(key, value));
      if (usuario) window.sessionStorage.setItem('usuarioLogado', JSON.stringify(usuario));
      window.fetch = async (url, options = {}) => {
        const method = options.method || 'GET';
        calls.push({
          method: method,
          url: url,
          headers: { ...options.headers },
          body: options.body ? JSON.parse(options.body) : undefined
        });
        let response = routes[method + ' ' + url];
        if (Array.isArray(response)) response = response.length > 1 ? response.shift() : response[0];
        response = response || { status: 200, body: [] };
        if (response.fail) throw new TypeError('Failed to fetch');
        return { status: response.status, json: async () => response.body };
      };
    }
  });
  const window = dom.window;
  // Inline dashboard code calls the global toast; record what it shows.
  window.toast = (msg) => toasts.push(msg);
  return { window, document: window.document, calls, toasts };
}

function settle(ms = 30) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pressEscape(window) {
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

const GESTOR = { id: 1, nome: 'Diretor João', email: 'joao.diretor@escola.gov.br', perfil: 'gestor_escolar' };
const DOCENTE = { id: 12, nome: 'Maria Silva', email: 'maria.silva@escola.gov.br', perfil: 'docente' };
const PSICOLOGA = { id: 8, nome: 'Psicóloga Amanda Costa', perfil: 'equipe_multidisciplinar' };

module.exports = { loadDashboard, settle, pressEscape, GESTOR, DOCENTE, PSICOLOGA };
