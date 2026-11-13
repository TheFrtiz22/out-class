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
 assert.match(src,/useState<"corkboard" \| "list" \| null>\(null\)/,'the device default is decided by CSS until the browser settles it');
 assert.match(src,/\(view \? \[view\] : \(\["list", "corkboard"\] as const\)\)\.map\(shown =>/,'server HTML carries both views before the choice settles');
 assert.match(src,/data-device-default=\{view \? undefined : shown\}/);
 const ev=css('components/events/events.css');
 assert.match(ev,/@media \(max-width: 1023px\) \{ \.oc-event-view\[data-device-default="corkboard"\] \{ display: none; \} \}/,'phones show the list from the first paint');
 assert.match(ev,/@media \(min-width: 1024px\) \{ \.oc-event-view\[data-device-default="list"\] \{ display: none; \} \}/,'desktop keeps the board');
 const s=css('components/events/events.css'),phone=s.slice(s.lastIndexOf('@media (max-width: 1023px) {'));
 assert.match(phone,/\.oc-smart-event-card \{ display: flex; flex-direction: column;/);
});
test('phone Calendar: filters behind a Filter button; phone Profile: navy student card; both scoped to <1024px',()=>{
 const src=css('components/views/calendar-view.tsx');
 assert.match(src,/className="oc-calendar-filter-toggle" aria-expanded=\{phoneFilters\} aria-controls="calendar-tools"/);
 assert.match(src,/id="calendar-tools" className="oc-toolbar oc-calendar-tools" data-phone-open=\{phoneFilters \|\| undefined\}/);
 assert.match(css('components/views/unified-student-profile-view.tsx'),/"oc-profile-identity pb-9/);
 const s=css('styles/product-components.css');assert.match(s,/^\.oc-calendar-filter-toggle \{ display: none !important; \}/m);
 const phone=s.slice(s.lastIndexOf('@media (max-width: 1023px) {'));
 assert.match(phone,/\.oc-calendar-tools:not\(\[data-phone-open\]\) \{ display: none; \}/);
 assert.match(phone,/\[data-product-shell\] \.oc-student-profile > \.oc-profile-identity \{[^}]*var\(--oc-glass-navy-material\)/);
});
test('a member inside a club keeps More for the club pages; the personal rail gets the five app tabs',()=>{
 const nav=require('./helpers/navigation-module.cjs');
 const member=nav.memberRailSections('club-1','Chess Club');
 assert.deepEqual(nav.bottomBarItems(member,'personal','club-home').map(item=>item.id),['student-dashboard','explore','inbox','calendar'],'four tabs, so More opens the sheet');
 assert.deepEqual(member.find(section=>section.id==='member-club').items.map(item=>item.id),['club-home','club-meetings','club-tasks'],'the sheet lists the club pages');
 assert.ok(nav.railItems?nav.railItems(member).some(item=>item.id==='student-profile'):member.some(section=>section.items.some(item=>item.id==='student-profile')),'Profile stays in the sheet');
 assert.deepEqual(nav.bottomBarItems(nav.personalRailSections(),'personal','student-dashboard').map(item=>item.id),['student-dashboard','explore','inbox','calendar','student-profile']);
});
