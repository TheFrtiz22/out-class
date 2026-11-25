const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

// Render the real MeetingEditor with a minimal hook scheduler, the draft stub and the real meeting schema.
function editorHarness() {
  const slots = [];
  let index = 0;
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], (next) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useEffect() { index++; }, useLayoutEffect() { index++; }, useRef(value) { const i = index++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
    useCallback(fn) { index++; return fn; }, useMemo(fn) { index++; return fn(); },
  };
  const libCache = {};
  const loadLib = (name) => {
    if (libCache[name]) return libCache[name];
    const file = name.slice(2) + ".ts", mod = { exports: {} };
    libCache[name] = mod.exports;
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", js)((n) => (n.startsWith("@/lib/") ? loadLib(n) : n.startsWith("@/") ? new Proxy({}, { get: (_, key) => String(key) }) : require(n)), mod, mod.exports);
    return mod.exports;
  };
  const mocks = { react, "next/dynamic": { default: () => () => null }, "@/hooks/use-editor-draft": require("./helpers/autosave-ui-harness.cjs").draftStub, "@/lib/workspace-api": { saveMeeting: async () => { throw new Error("should not save"); } } };
  const mod = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync("components/meeting-workspace.tsx", "utf8") + "\nexports.MeetingEditor = MeetingEditor;", { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", js)((name) => mocks[name] || (name === "react/jsx-runtime" ? require(name) : name.startsWith("@/lib/") ? loadLib(name) : new Proxy({}, { get: (_, key) => String(key) })), mod, mod.exports);
  return { render() { index = 0; return mod.exports.MeetingEditor({ clubId: "00000000-0000-4000-8000-000000000001", onSaved() {}, onCancel() {} }); } };
}
const all = (n) => !n || typeof n !== "object" ? [] : Array.isArray(n) ? n.flatMap(all) : [n, ...all(n.props?.children)];
const field = (tree, name) => all(tree).find((n) => n.props?.name === name);
const alertText = (tree) => all(tree).filter((n) => n.type === "p" && n.props.role === "alert").map((n) => String(n.props.children)).join("");

test("fixing the end time clears the earlier refusal", async () => {
  const h = editorHarness();
  for (const [name, value] of [["title", "Board meeting"], ["location", "Rice Hall"], ["date", "2026-11-26T13:00"], ["endDate", "2026-11-26T12:00"]]) field(h.render(), name).props.onChange({ target: { value } });
  const form = all(h.render()).find((n) => n.type === "form");
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(alertText(h.render()), "End time must follow the start.");
  field(h.render(), "endDate").props.onChange({ target: { value: "2026-11-26T14:00" } });
  assert.equal(alertText(h.render()), "", "the refusal no longer applies once the end time moves");
});
