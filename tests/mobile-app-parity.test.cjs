// Phones match the OutClass app; desktop (1024px and wider) keeps its own layout.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const css=p=>fs.readFileSync(p,'utf8');
test('phone Home and the desktop dashboard never show together',()=>{
 const s=css('components/views/student-home.css');
 assert.match(s,/^\.oc-home-phone \{ display: none; \}/m,'phone layout hidden by default (desktop)');
 const phone=s.slice(s.indexOf('@media (max-width: 1023px) {'));
 assert.match(phone,/\.oc-student-home \.oc-home-dashboard \{ display: none; \}/);
 assert.match(phone,/\.oc-home-phone \{ display: grid;/);
});
test('phone Home reads the same records as the desktop dashboard and renders once per view',()=>{
 const src=css('components/views/student-dashboard-view.tsx');
 assert.equal((src.match(/<AvailabilityDashboardRequests \/>/g)||[]).length,1,'availability requests render once, not per layout');
 for(const section of ['"To-do"','"Coming up"','Furthest along','"Applications"','TERMS.myClubs'])assert.ok(src.includes(section),section);
 assert.ok(!/fetch\(|workspace-api/.test(src.slice(src.indexOf('const phone ='),src.indexOf('return (\n    <div className="oc-student-home">'))),'the phone block fetches nothing of its own');
});
test('the Explore switch and the phone logo appear only on phones inside the signed-in shell',()=>{
 const s=css('components/explore-switch.css');assert.match(s,/^\.oc-explore-switch \{ display: none; \}/m);assert.match(s,/\[data-product-shell\] \.oc-explore-switch \{ display: grid;/);
 const h=css('components/shell/floating-header.css');assert.match(h,/^\.oc-product-brand \{ display: none; \}/m);
 const phone=h.slice(h.indexOf('@media (max-width: 759px) {'));assert.match(phone.slice(0,phone.indexOf('\n}')),/\.oc-product-brand \{ display: inline-flex;[^}]*min-height: 44px/);
});
test('phone Explore: filters sit behind a Filter button with an active count; desktop keeps them open',()=>{
 const src=css('components/views/explore-view.tsx');
 assert.match(src,/className="oc-directory-filter-toggle" aria-label=\{phoneActive \? `Filter clubs \(\$\{phoneActive\} active\)` : "Filter clubs"\} aria-expanded=\{phoneFilters\} aria-controls="directory-tools"/);
 assert.match(src,/id="directory-tools" className="oc-directory-tools oc-toolbar" data-phone-open=\{phoneFilters \|\| undefined\}/);
 const s=css('components/clubs/explore-directory.css');assert.match(s,/^\.oc-directory-filter-toggle \{ display: none; \}/m);
 const phone=s.slice(s.lastIndexOf('@media (max-width: 1023px) {'));
 assert.match(phone,/\.oc-discovery \.oc-directory-tools:not\(\[data-phone-open\]\)[^{]*\{ display: none; \}/);
 assert.match(phone,/\.oc-explore-card-cover \{ height: 5\.25rem; \}/);
});
test('phone club page: full-width actions and card sections only below 1024px',()=>{
 const s=css('components/clubs/club-discovery.css'),phone=s.slice(s.lastIndexOf('@media (max-width: 1023px) {'));
 assert.match(phone,/\.oc-club-action-row \{ display: grid; grid-template-columns: 1fr;/);
 assert.match(phone,/\.oc-club-profile \.oc-club-section \{[^}]*border-radius: var\(--oc-content-radius\)/);
});
test('phone Events open on the card list until the student picks a view; desktop keeps the board',()=>{
 const src=css('components/events/public-event-board.tsx');
 const at=src.indexOf('const preference = localStorage.getItem("outclass:events:view:v1");');assert.ok(at>0);
 const block=src.slice(at,at+400);
 assert.ok(block.indexOf('if (preference === "list" || preference === "corkboard") setView(preference);')<block.indexOf('matchMedia?.("(max-width: 1023px)").matches) setView("list")'),'a saved choice wins over the phone default');
 assert.match(src,/useState<"corkboard" \| "list">\("corkboard"\)/,'desktop default unchanged');
 const s=css('components/events/events.css'),phone=s.slice(s.lastIndexOf('@media (max-width: 1023px) {'));
 assert.match(phone,/\.oc-smart-event-card \{ display: flex; flex-direction: column;/);
});
