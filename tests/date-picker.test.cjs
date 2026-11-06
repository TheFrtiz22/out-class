const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path')
const {loadComponent}=require('./helpers/component-module.cjs')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const picker=loadComponent(path.resolve('components/ui/date-picker.tsx'))
const {daySlotSummary}=loadComponent(path.resolve('components/interviews/day-range.ts'))

test('date picker day-key math stays on calendar dates across month, year, leap and DST boundaries',()=>{
  const {addDayKeys,addMonthKeys,moveDayKey,weekdayOf,startOfWeekKey,endOfWeekKey,isDayKey}=picker
  assert.equal(addDayKeys('2026-10-31',1),'2026-11-01');assert.equal(addDayKeys('2026-01-01',-1),'2025-12-31')
  assert.equal(addDayKeys('2026-03-08',1),'2026-03-09','US spring-forward day');assert.equal(addDayKeys('2026-11-01',1),'2026-11-02','US fall-back day')
  assert.equal(addMonthKeys('2026-01-31',1),'2026-02-28');assert.equal(addMonthKeys('2028-01-31',1),'2028-02-29');assert.equal(addMonthKeys('2026-12-15',1),'2027-01-15');assert.equal(addMonthKeys('2026-03-31',-1),'2026-02-28')
  assert.equal(weekdayOf('2026-11-06'),5);assert.equal(startOfWeekKey('2026-11-06'),'2026-11-01');assert.equal(endOfWeekKey('2026-11-06'),'2026-11-07')
  const k='2026-11-06'
  assert.deepEqual(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].map(key=>moveDayKey(k,key)),['2026-11-05','2026-11-07','2026-10-30','2026-11-13','2026-10-06','2026-12-06','2026-11-01','2026-11-07'])
  assert.equal(moveDayKey(k,'PageUp',true),'2025-11-06');assert.equal(moveDayKey(k,'PageDown',true),'2027-11-06');assert.equal(moveDayKey(k,'Tab'),null)
  assert.equal(isDayKey('2026-02-29'),false);assert.equal(isDayKey('2028-02-29'),true);assert.equal(isDayKey(''),false);assert.equal(isDayKey('2026-1-01'),false)
})

test('date picker grid, bounds and labels ignore the host time zone',()=>{
  const {monthGrid,clampDayKey,isDayKeyDisabled,formatDayKey,todayDayKey}=picker
  const weeks=monthGrid('2026-11-17');assert.equal(weeks.length,5);assert.equal(weeks[0][0],'2026-11-01');assert.equal(weeks.at(-1)[6],'2026-12-05');assert.ok(weeks.every(w=>w.length===7))
  const feb=monthGrid('2026-02-10');assert.equal(feb[0][0],'2026-02-01');assert.equal(feb.length,4)
  assert.equal(clampDayKey('2026-10-01','2026-10-05','2026-10-20'),'2026-10-05');assert.equal(clampDayKey('2026-10-30','2026-10-05','2026-10-20'),'2026-10-20');assert.equal(clampDayKey('2026-10-10','','' ),'2026-10-10')
  assert.equal(isDayKeyDisabled('2026-10-04','2026-10-05'),true);assert.equal(isDayKeyDisabled('2026-10-05','2026-10-05','2026-10-05'),false);assert.equal(isDayKeyDisabled('2026-10-06',undefined,'2026-10-05'),true)
  assert.equal(formatDayKey('2026-11-01'),'Nov 1, 2026');assert.equal(formatDayKey('2026-11-01','long'),'Sunday, November 1, 2026')
  assert.equal(todayDayKey('America/New_York',new Date('2026-11-07T03:30:00Z')),'2026-11-06','late evening Eastern stays on the Eastern date')
})

test('date picker trigger keeps the native value contract and accessible name',()=>{
  const html=renderToStaticMarkup(React.createElement(picker.DatePicker,{value:'2026-11-06',onChange(){},'aria-label':'Panel window from',name:'from',today:'2026-11-06'}))
  assert.match(html,/aria-label="Panel window from"/);assert.match(html,/data-value="2026-11-06"/);assert.match(html,/Nov 6, 2026/);assert.match(html,/type="hidden" name="from" value="2026-11-06"/);assert.match(html,/aria-haspopup="dialog"/)
  const empty=renderToStaticMarkup(React.createElement(picker.DatePicker,{value:'',onChange(){},'aria-label':'Filter',placeholder:'All dates',disabled:true}))
  assert.match(empty,/All dates/);assert.match(empty,/data-value=""/);assert.match(empty,/disabled=""/)
})

test('collapsed day rows summarize first and last slot in Eastern display',()=>{
  const at=(iso)=>({startTime:iso})
  assert.equal(daySlotSummary([at('2026-10-20T20:30:00Z'),at('2026-10-20T13:00:00Z'),at('2026-10-20T15:00:00Z')]),'3 slots · 9:00 AM–4:30 PM')
  assert.equal(daySlotSummary([at('2026-10-20T13:00:00Z')]),'1 slot · 9:00 AM')
  assert.equal(daySlotSummary([]),'No slots')
  assert.equal(daySlotSummary([at('2026-12-01T14:00:00Z'),at('2026-12-01T14:00:00Z')]),'2 slots · 9:00 AM','EST in winter; identical starts collapse to one time')
  assert.equal(daySlotSummary([at('2026-10-20T13:00:00Z')],'America/New_York'),'1 slot · 9:00 AM')
})
