const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  ts = require("typescript");
function load(file, mocks) {
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
  )(
    (n) =>
      n in mocks
        ? mocks[n]
        : n.startsWith("@/lib/")
          ? load(n.replace("@/", "") + ".ts", mocks)
          : n.startsWith("@/") || n.startsWith("./") || n.endsWith(".css")
            ? new Proxy({}, { get: (_, k) => k })
            : require(n),
    m,
    m.exports,
  );
  return m.exports;
}
const all = (n) =>
  !n || typeof n !== "object"
    ? []
    : Array.isArray(n)
      ? n.flatMap(all)
      : [n, ...all(n.props?.children)];
const title = (n) =>
  typeof n === "string"
    ? n
    : Array.isArray(n)
      ? n.map(title).join("")
      : n?.props
        ? title(n.props.children)
        : "";
test("board uses original flyer in accessible modal, keyboard button activation and origin focus return", () => {
  const event = {
    id: "fixture",
    clubId: "club",
    clubName: "Club",
    title: "Campus Night",
    description: "Details",
    date: "2030-10-16T23:00Z",
    endDate: "2030-10-17T01:00Z",
    location: "Hall",
    category: "Social",
    contact: "",
    rsvpEnabled: true,
    rsvpRequired: false,
    capacity: 20,
    rsvpDeadline: null,
    template: "academic",
    flyerUrl: null,
    rsvpCount: 3,
    revision: 0,
  };
  const slots = [],
    refs = [];
  let cursor = 0,
    refCursor = 0;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        slots[i],
        (next) =>
          (slots[i] = typeof next === "function" ? next(slots[i]) : next),
      ];
    },
    useRef(initial) {
      return (refs[refCursor++] ??= { current: initial });
    },
    useEffect() {},
  };
  const { PublicEventBoard } = load(
    "components/events/public-event-board.tsx",
    {
      react,
      "next/link": { default: "Link" },
      "next/navigation": { useSearchParams: () => new URLSearchParams() },
      "@/contexts/auth-context": { useAuth: () => ({ user: null }) },
      "@/lib/workspace-api": {},
    },
  );
  const render = () => {
    cursor = 0;
    refCursor = 0;
    return PublicEventBoard();
  };
  render();
  slots[1] = [event];
  slots[3] = 1;
  slots[5] = false;
  let tree = render();
  const trigger = all(tree).find(
    (n) =>
      n.type === "button" && n.props["aria-label"]?.includes("Campus Night"),
  );
  assert.ok(trigger);
  assert.equal(trigger.props.type, "button");
  let focused = false;
  const origin = {
    isConnected: true,
    focus() {
      focused = true;
    },
  };
  trigger.props.onClick({ currentTarget: origin });
  all(tree)
    .find((n) => n.type === "Dialog")
    .props.onOpenChange(true);
  tree = render();
  const dialog = all(tree).find((n) => n.type === "DialogContent");
  assert.ok(dialog);
  assert.match(dialog.props.className, /oc-event-detail/);
  assert.ok(
    all(dialog).some(
      (n) => n.type === "EventFlyer" && n.props.event.id === event.id,
    ),
  );
  assert.ok(
    all(dialog).some(
      (n) => n.type === "DialogTitle" && title(n) === "Campus Night",
    ),
  );
  assert.match(title(dialog), /17 remaining/);
  let prevented = false;
  dialog.props.onCloseAutoFocus({
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(focused, true);
  assert.equal(prevented, true);
  const filter = all(tree).find((n) => n.type === "details");
  assert.ok(filter);
  assert.ok(
    all(filter).some((n) => n.type === "Input" && n.props.type === "date"),
  );
});
test("reduced motion removes pull and overlay animation; Escape and focus trapping use the existing Radix primitive", () => {
  const css = fs
      .readFileSync("components/events/events.css", "utf8")
      .replace(/\s|"/g, ""),
    dialog = fs.readFileSync("components/ui/dialog.tsx", "utf8");
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(
    css,
    /\.oc-event-detail\[data-state=open\],\.oc-event-detail\[data-state=closed\]\{animation:none!important/,
  );
  assert.match(css, /dialog-overlay.*animation:none!important/);
  assert.match(dialog, /@radix-ui\/react-dialog/);
});
