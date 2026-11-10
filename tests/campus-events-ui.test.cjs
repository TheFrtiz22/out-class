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
      "./use-saved-campus-events": { useSavedCampusEvents: () => ({ ids: new Set(), pending: new Set(), ready: false, error: "" }) },
      "@/hooks/use-dismissable-details": { useDismissableDetails: () => filterMenu },
    },
  );
  function filterMenu() {}
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
  const filterDetails = all(tree).find((n) => n.type === "details" && n.props.className === "oc-event-filter");
  assert.equal(filterDetails.props.ref, filterMenu, "Corkboard Filter closes on Escape and outside press");
  const trigger = all(tree).find(
    (n) =>
      n.type === "button" && n.props.className === "oc-pinned-flyer",
  );
  assert.ok(trigger);
  assert.equal(trigger.props.type, "button");
  // The poster's visible content supplies its name, including its event title.
  // An overriding aria-label previously omitted visible words (WCAG 2.5.3).
  assert.equal(trigger.props["aria-label"], undefined);
  assert.ok(all(trigger).some(n => n.props?.event?.title === "Campus Night"));
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

test("leader Meetings and Events are separate sections; Demo still isolates unavailable events (FE-12)", () => {
  let params = new URLSearchParams('section=meetings'), demo = false;
  const { ClubMeetingsWorkspace } = load('components/events/club-meetings-workspace.tsx', {
    'next/navigation': { useSearchParams: () => params },
    '@/contexts/demo-context': { useDemoMode: () => ({isDemoEnabled: demo}) },
  });
  const props={clubId:'club',clubName:'Club',canSeeAttendees:true};
  let tree=ClubMeetingsWorkspace(props);
  const list=all(tree).find(n=>n.type==='MeetingList');
  assert.equal(list.props.initialAudience,'ALL');
  assert.equal(list.props.toolbarStart,undefined,'no Meetings/Events switch: Events has its own nav entry');
  assert.ok(!all(tree).some(n=>n.type==='ClubEvents'));
  params=new URLSearchParams('section=meetings&new=1');tree=ClubMeetingsWorkspace(props);
  assert.equal(all(tree).find(n=>n.type==='MeetingList').props.openCreate,true);
  params=new URLSearchParams('section=events');tree=ClubMeetingsWorkspace({...props,events:true});
  assert.ok(all(tree).some(n=>n.type==='ClubEvents'));
  assert.ok(!all(tree).some(n=>n.type==='MeetingList'));
  demo=true;tree=ClubMeetingsWorkspace({...props,events:true});
  assert.match(title(tree),/not available in Demo yet/);
  assert.ok(!all(tree).some(n=>n.type==='ClubEvents'));
});

test("the workspace renders the Events section for meeting managers (FE-12)", () => {
  const workspace=fs.readFileSync('components/club-workspace.tsx','utf8');
  assert.match(workspace,/section === "events" && hasPermission\(membership, "meetings\.manage"\) && <ClubMeetingsWorkspace [^>]*\bevents \/>/);
  // Members without meetings.manage who follow an old Events link land on Meetings, never a "not available" page
  // (verified in a production build: both old link forms -> ?section=meetings, title Meetings, no alert).
  assert.match(workspace,/const eventsFallback = section === "events" && membership && !hasPermission\(membership, "meetings\.manage"\)/);
  assert.match(workspace,/next\.set\("section", "meetings"\); next\.delete\("meetingTab"\)/);
  assert.match(workspace,/\|\| eventsFallback\) return <WorkspaceLoading/);
  assert.doesNotMatch(workspace,/legacyEvents/);
});

test("leader removal requires confirmation and returns keyboard focus to its origin", async () => {
  const slots=[], refs=[];let cursor=0,refCursor=0;const calls=[];
  const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(initial){return refs[refCursor++]??={current:initial}},useEffect(){}};
  const {ClubEvents}=load('components/events/club-events.tsx',{react,'@/hooks/use-revalidate':{useRevalidate(){}},'@/lib/workspace-api':{commandCampusEvent:async input=>calls.push(input)}});
  const render=()=>{cursor=0;refCursor=0;return ClubEvents({clubId:'club',clubName:'Club',canSeeAttendees:true})};
  render();slots[0]=[{id:'event',clubId:'club',title:'Public night',date:'2099-10-16T23:00:00Z',endDate:'2099-10-17T01:00:00Z',location:'Hall',status:'PUBLISHED',revision:2,rsvpCount:1,capacity:2}];slots[1]=false;
  let tree=render();let focused=false;const origin={isConnected:true,focus(){focused=true}};
  all(tree).find(n=>n.type==='Button' && title(n)==='Remove from Corkboard').props.onClick({currentTarget:origin});assert.equal(calls.length,0);
  tree=render();const dialog=all(tree).find(n=>n.type==='DialogContent');
  assert.match(title(dialog),/history and RSVP records will remain/);
  let prevented=false;dialog.props.onCloseAutoFocus({preventDefault(){prevented=true}});assert.ok(focused && prevented);
  await all(dialog).find(n=>n.type==='Button' && title(n)==='Remove from Corkboard').props.onClick();
  assert.equal(calls.length,1);assert.equal(calls[0].command,'WITHDRAW');assert.equal(calls[0].revision,2);
});
