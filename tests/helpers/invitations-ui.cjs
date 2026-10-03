const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
function harness(api, file, props, auth = { user: { id: 'user' }, refreshUser: async () => {} }) {
  const state = [], effects = [], cleanups = new Map(), cache = {}, timers = new Map(), toasts = [];
  let cursor = 0, contextValue, timerId = 0;
  const listeners = {};
  const surface = { visibilityState: "visible", addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name => { delete listeners[name]; } };
  const react = {
    createContext: () => ({ Provider: 'Provider' }), useContext: () => contextValue,
    useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef: initial => { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i]; },
    useEffect: (effect, deps) => { const i = cursor++; if (!state[i] || deps.some((v, j) => v !== state[i][j])) { state[i] = deps; effects.push([i, effect]); } },
  };
  const demo = { isDemoEnabled: false };
  function load(file) {
    file = path.resolve(file); if (cache[file]) return cache[file].exports;
    const mod = { exports: {} }; cache[file] = mod;
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'window', 'document', compiled)(name => {
      if (name === 'react') return react;
      if (name === 'next/link') return { default: 'Link' };
      if (name === 'sonner') return { toast: { success: value => toasts.push(value), error: value => toasts.push(value) } };
      if (name === '@/contexts/auth-context') return { useAuth: () => auth };
      if (name === '@/contexts/demo-context') return { useDemoMode: () => demo };
      if (name === '@/utils/auth') return { requireAuth: api.requireAuth };
      if (name === '@/utils/profile-onboarding') return { requireCompletedStudentProfile: api.requireCompletedStudentProfile };
      if (name === '@/actions/club-onboarding' || name === '@/actions/club-access') return api;
      if (name.startsWith('@/components/')) {
        const key = name.split('/').pop().replace(/(^|-)(\w)/g, (_, _prefix, letter) => letter.toUpperCase());
        return { [key === 'Button' ? 'Button' : key]: key };
      }
      if (name.startsWith('@/')) { const base = name.slice(2); return load(base + (fs.existsSync(base + '.ts') ? '.ts' : '.tsx')); }
      return require(name);
    }, mod, mod.exports, fn => { const id = ++timerId; timers.set(id, fn); return id; }, id => timers.delete(id), fn => { const id = ++timerId; timers.set(id, fn); return id; }, id => timers.delete(id), { ...surface, location: global.window?.location }, surface);
    return mod.exports;
  }
  const Component = Object.values(load(file)).find(value => typeof value === 'function');
  const shared = file === 'components/organization-ownership-requests.tsx';
  const Provider = shared && load('contexts/organization-invitations-context.tsx').OrganizationInvitationsProvider;
  return {
    render() {
      cursor = 0;
      if (Provider) {
        contextValue = Provider({ children: null }).props.value;
      }
      return Component(props);
    },
    async flush() {
      for (const [i, effect] of effects.splice(0)) { cleanups.get(i)?.(); cleanups.set(i, effect()); }
      for (let i = 0; i < 10; i++) await Promise.resolve();
    },
    async finishCollapse() { for (const fn of [...timers.values()]) fn(); timers.clear(); },
    context: () => contextValue, focus: () => listeners.focus?.(), auth, demo, toasts, load,
  };
}
module.exports = { harness, nodes };
