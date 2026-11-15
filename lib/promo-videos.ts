/**
 * The public promo videos (docs/public-site/videos.md). Files live in public/videos: one .mp4 and one
 * .jpg poster per video, both named `file`. Every video is 1920 x 1080 with music and on-screen text and
 * no narration, so `summary` is its text alternative: say what the video shows, not how it looks.
 */
export const promoVideos = {
  overview: {
    file: "outclass-overview",
    title: "OutClass in 51 seconds",
    seconds: 51,
    summary: "A 51-second tour with music and on-screen text, no narration. A student builds one profile, finds a club and applies. The club reviews applicants, schedules interviews, runs a live interview room and a vote, and sends every applicant a decision.",
  },
  "club-pitch": {
    file: "outclass-for-clubs-pitch",
    title: "Six tools, one place",
    seconds: 59,
    summary: "A 59-second video with music and on-screen text, no narration. It names six tools clubs use to run recruitment (a sign-up form, a spreadsheet, an availability poll, a shared doc, a group chat and a mail merge) and shows the OutClass screen that replaces each one.",
  },
  "club-walkthrough": {
    file: "outclass-for-clubs-walkthrough",
    title: "The full walkthrough for club leaders",
    seconds: 128,
    summary: "A two-minute video with music and on-screen text, no narration, in five chapters: open applications, review applicants, interview, decide, and run the club with meetings, tasks and a member roster.",
  },
  students: {
    file: "outclass-for-students",
    title: "OutClass for students",
    seconds: 96,
    summary: "A 96-second video with music and on-screen text, no narration. It shows every application in one tracker, one profile reused for each club, finding and reading about clubs, applying, booking an interview, and getting a decision whether it is a yes or a no.",
  },
  universities: {
    file: "outclass-for-universities",
    title: "OutClass for a campus",
    seconds: 96,
    summary: "A 96-second video with music and on-screen text, no narration. It shows what students get (one directory, one profile, a status for every application and an answer every time), what student leaders get (one list of applicants and one workspace for the season), and what a campus gets (club rosters with roles, and attendance by QR check-in).",
  },
} as const

export type PromoVideoId = keyof typeof promoVideos

export const promoVideoSrc = (id: PromoVideoId) => `/videos/${promoVideos[id].file}.mp4`
export const promoVideoPoster = (id: PromoVideoId) => `/videos/${promoVideos[id].file}.jpg`
/** One shared captions file: a single cue saying the sound is instrumental music, with no narration. */
export const PROMO_VIDEO_CAPTIONS = "/videos/instrumental.vtt"

/** "0:59", "2:08": the running time as a player shows it. */
export function promoVideoLength(id: PromoVideoId) {
  const { seconds } = promoVideos[id]
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/** "59 seconds", "2 minutes 8 seconds": the running time read aloud. */
export function promoVideoSpokenLength(id: PromoVideoId) {
  const { seconds } = promoVideos[id]
  const minutes = Math.floor(seconds / 60), rest = seconds % 60
  const unit = (count: number, name: string) => `${count} ${name}${count === 1 ? "" : "s"}`
  return [minutes ? unit(minutes, "minute") : "", rest ? unit(rest, "second") : ""].filter(Boolean).join(" ")
}
