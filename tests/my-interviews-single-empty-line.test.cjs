const test = require("node:test")
const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
// A day with no bookings said it twice: "10:00 AM–12:00 PM · No bookings yet" over "4 open times, none booked yet".
// The day header keeps the time range and only counts interviews when there are some; the list line says the rest.
test("a day with no bookings says so once, in the open-times line", () => {
  const list = readFileSync("components/interviews/interview-rooms-list.tsx", "utf8")
  assert.doesNotMatch(list, /No bookings yet/)
  assert.match(list, /open time"\)\}, none booked yet/)
  assert.match(list, /\{booked \? ` · \$\{pluralize\(booked, "interview"\)\}` : ""\}/)
})
