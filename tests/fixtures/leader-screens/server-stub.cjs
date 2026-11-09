/* Server actions and server-only modules are never called in the leader fixture: Demo Mode answers
   every read and write in the browser (lib/workspace-api.ts → lib/demo/workspace.ts). A live call fails loudly. */
const live = name => async () => { throw new Error(`Live server call in the leader fixture: ${String(name)}`) }
module.exports = new Proxy({}, { get: (_target, key) => key === '__esModule' ? false : key === 'then' ? undefined : live(key) })
