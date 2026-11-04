const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const jsQR = require("jsqr");
const sharp = require("sharp");

// Custom module loader for TypeScript files in this repository
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const content = fs.readFileSync(file, "utf8");
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  new Function("require", "module", "exports", transpiled)(
    (n) => {
      if (n in mocks) return mocks[n];
      if (n.startsWith("@/lib/")) return load(n.replace("@/", "") + ".ts", mocks);
      if (n.startsWith("@/actions/")) return load(n.replace("@/", "") + ".ts", mocks);
      return require(n);
    },
    mod,
    mod.exports,
  );
  return mod.exports;
}

// Load QR rendering and shortlink libraries
const qrRenderer = load("lib/qr/renderer.ts");
const qrConstants = load("lib/qr/constants.ts");
const shortLinks = load("lib/short-links.ts");

// Helper to rasterize SVG string and decode using jsQR
async function decodeSvg(svgString, rasterSize = 600) {
  const pngBuffer = await sharp(Buffer.from(svgString))
    .resize(rasterSize, rasterSize)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const decoded = jsQR(
    new Uint8ClampedArray(pngBuffer.data),
    pngBuffer.info.width,
    pngBuffer.info.height,
  );
  return decoded ? decoded.data : null;
}

// Helper to rasterize SVG onto a dark background with a container margin
async function decodeSvgOnDarkBackground(svgString, containerSize = 700) {
  const qrPng = await sharp(Buffer.from(svgString)).resize(500, 500).toBuffer();
  const compositeBuffer = await sharp({
    create: {
      width: containerSize,
      height: containerSize,
      channels: 4,
      background: { r: 10, g: 15, b: 25, alpha: 1 }, // Dark mode UI background
    },
  })
    .composite([{ input: qrPng, top: 100, left: 100 }])
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const decoded = jsQR(
    new Uint8ClampedArray(compositeBuffer.data),
    compositeBuffer.info.width,
    compositeBuffer.info.height,
  );
  return decoded ? decoded.data : null;
}

// =========================================================================
// TEST SUITE: Universal OutClass Branded QR Code System (17 Required Areas)
// =========================================================================

test("1. Short and long URL payloads decode with 100% fidelity", async () => {
  const shortPayload = "https://out-class.net/q/a7K2mP";
  const longPayload =
    "https://out-class.net/check-in?meetingId=99099888-7766-5544-3322-110011223344&round=fall-2026-recruitment-info-session&source=rotunda-flyer-printed-bulletin#token=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

  const shortSvg = qrRenderer.generateOutClassQRSVG(shortPayload);
  const longSvg = qrRenderer.generateOutClassQRSVG(longPayload);

  assert.equal(await decodeSvg(shortSvg), shortPayload);
  assert.equal(await decodeSvg(longSvg, 800), longPayload);
});

test("2. Different QR matrix sizes decode accurately across versions", async () => {
  const payloads = [
    { label: "Version 1/2 payload", data: "https://out-class.net/q/x1" },
    { label: "Version 4 payload", data: "https://out-class.net/q/a7K2mP" },
    { label: "Version 7 payload", data: "https://out-class.net/vote?session=00000000-0000-4000-8000-000000000001" },
    { label: "Version 10 payload", data: "https://out-class.net/meetings/00000000-0000-4000-8000-000000000001/check-in?t=1234567890abcdef1234567890abcdef" },
  ];

  for (const item of payloads) {
    const svg = qrRenderer.generateOutClassQRSVG(item.data);
    const decoded = await decodeSvg(svg, 700);
    assert.equal(decoded, item.data, `Failed decoding ${item.label}`);
  }
});

test("3. Embedded logo rendering with official OC monogram retains error correction margin", async () => {
  const payload = "https://out-class.net/q/monogram";

  // With logo enabled
  const svgWithLogo = qrRenderer.generateOutClassQRSVG(payload, { showLogo: true });
  assert.ok(svgWithLogo.includes(qrConstants.OC_MONOGRAM_PATHS[0].slice(0, 20)));
  assert.equal(await decodeSvg(svgWithLogo), payload);

  // With logo disabled
  const svgWithoutLogo = qrRenderer.generateOutClassQRSVG(payload, { showLogo: false });
  assert.equal(await decodeSvg(svgWithoutLogo), payload);
});

test("4. Circular finder patterns replace square finders while preserving scanner ratios", async () => {
  const payload = "https://out-class.net/q/finders";
  const svg = qrRenderer.generateOutClassQRSVG(payload, { circularFinders: true });

  // Verify concentric circles (3.5, 2.5, 1.5 radius)
  assert.ok(svg.includes('r="3.5"'));
  assert.ok(svg.includes('r="2.5"'));
  assert.ok(svg.includes('r="1.5"'));

  const decoded = await decodeSvg(svg);
  assert.equal(decoded, payload);
});

test("5. SVG and PNG exports maintain scannability and high contrast", async () => {
  const payload = "https://out-class.net/q/exportTest";
  const svg = qrRenderer.generateOutClassQRSVG(payload);

  // Test SVG string export
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.endsWith("</svg>"));

  // Test PNG rasterization
  const pngBuffer = await sharp(Buffer.from(svg)).resize(1024, 1024).png().toBuffer();
  const rawPng = await sharp(pngBuffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(rawPng.data), rawPng.info.width, rawPng.info.height);
  assert.ok(decoded);
  assert.equal(decoded.data, payload);
});

test("6. Small mobile display sizes remain scannable", async () => {
  const payload = "https://out-class.net/q/mobile";
  const svg = qrRenderer.generateOutClassQRSVG(payload);

  // Test small mobile rendering (160px and 200px)
  assert.equal(await decodeSvg(svg, 160), payload);
  assert.equal(await decodeSvg(svg, 200), payload);
});

test("7. High-resolution 2048px print output preserves sharp vector clarity", async () => {
  const payload = "https://out-class.net/q/print2048";
  const svg = qrRenderer.generateOutClassQRSVG(payload);

  const decoded = await decodeSvg(svg, 2048);
  assert.equal(decoded, payload);
});

test("8. Light and dark surrounding interfaces keep scanning surface high-contrast", async () => {
  const payload = "https://out-class.net/q/contrast";

  // White background
  const whiteSvg = qrRenderer.generateOutClassQRSVG(payload, { bgColor: "#ffffff" });
  assert.equal(await decodeSvgOnDarkBackground(whiteSvg), payload);

  // Warm ivory background token
  const ivorySvg = qrRenderer.generateOutClassQRSVG(payload, { bgColor: "#f8f7f4" });
  assert.equal(await decodeSvgOnDarkBackground(ivorySvg), payload);
});

test("9. Special characters, URL query parameters and hashes decode without corruption", async () => {
  const payload = "https://out-class.net/event?title=Welcome%20Picnic&room=Rotunda%20Room%20101&attendees=UVA%2BAlumni#check-in";
  const svg = qrRenderer.generateOutClassQRSVG(payload);
  assert.equal(await decodeSvg(svg, 750), payload);
});

test("10. Dense QR codes dynamically adjust center badge dimensions", async () => {
  // Test badge calculation for various sizes
  assert.equal(qrRenderer.getSafeBadgeSize(21), 3);
  assert.equal(qrRenderer.getSafeBadgeSize(25), 5);
  assert.equal(qrRenderer.getSafeBadgeSize(33), 7);
  assert.equal(qrRenderer.getSafeBadgeSize(57), 9);

  // Dense payload
  const densePayload = "https://out-class.net/events/spring-2026-intercollegiate-case-competition-registration-portal?clubId=00000000-0000-4000-8000-000000000001&source=printed-flyer&audience=STUDENT_BODY&referral=rotunda-kiosk";
  const svg = qrRenderer.generateOutClassQRSVG(densePayload);
  assert.equal(await decodeSvg(svg, 800), densePayload);
});

// In-memory PlatformContent supporting the filters lib/short-link-store.ts uses.
function platformStore() {
  const store = new Map();
  const matches = (row, where = {}) =>
    (!where.key?.startsWith || row.key.startsWith(where.key.startsWith)) &&
    (!where.updatedAt?.lt || row.updatedAt < where.updatedAt.lt) &&
    (where.AND || []).every(({ value }) => row.value?.[value.path[0]] === value.equals);
  const platformContent = {
    findUnique: async ({ where }) => store.get(where.key) || null,
    findMany: async ({ where }) => [...store.values()].filter((row) => matches(row, where)),
    create: async ({ data }) => {
      if (store.has(data.key)) throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
      const row = { ...data, updatedAt: new Date() };
      store.set(data.key, row);
      return row;
    },
    update: async ({ where, data }) => {
      const row = store.get(where.key);
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    upsert: async ({ where, update, create }) =>
      store.has(where.key) ? platformContent.update({ where, data: update }) : platformContent.create({ data: create }),
    deleteMany: async ({ where }) => {
      let count = 0;
      for (const row of [...store.values()]) if (matches(row, where)) { store.delete(row.key); count++; }
      return { count };
    },
  };
  return { store, platformContent };
}

function loadShortLinkModules(platformContent, authenticatedUser = { id: "leader" }) {
  const mocks = {
    "@/utils/prisma": { prisma: { platformContent } },
    "@/utils/auth": {
      requireAuth: async () => {
        if (!authenticatedUser) throw new Error("Authentication required.");
        return { user: authenticatedUser };
      },
    },
  };
  return { linkStore: load("lib/short-link-store.ts", mocks), shortLinksAction: load("actions/short-links.ts", mocks) };
}

const SESSION_ID = "00000000-0000-4000-8000-0000000000aa";
const CLUB_ID = "00000000-0000-4000-8000-000000000001";
const VOTING_JOIN = `/voting/${SESSION_ID}/join`;

test("11. Short-link generation and resolution produces valid compact links", async () => {
  const { platformContent } = platformStore();
  const { linkStore, shortLinksAction } = loadShortLinkModules(platformContent);

  const created = await shortLinksAction.createShortLink({ target: VOTING_JOIN });

  assert.match(created.code, /^[a-zA-Z0-9]{6,8}$/);
  assert.equal(created.shortUrl, `/q/${created.code}`);
  assert.deepEqual(Object.keys(created).sort(), ["code", "shortUrl"]);

  const resolved = await linkStore.resolveShortLink({ platformContent }, created.code);
  assert.equal(resolved.status, "valid");
  assert.equal(resolved.target, VOTING_JOIN);
  assert.equal(resolved.record.type, "vote");
});

test("12. Collision handling and identifier uniqueness over multiple generations", async () => {
  const generated = new Set();
  const iterations = 500;

  for (let i = 0; i < iterations; i++) {
    const code = shortLinks.generateRandomShortCode(6);
    assert.match(code, /^[0-9a-zA-Z]{6}$/);
    generated.add(code);
  }

  // 500 random base62 codes should be completely distinct
  assert.equal(generated.size, iterations);
});

test("13. Expired and closed meeting check-in links fail resolution with clear status", async () => {
  const { store, platformContent } = platformStore();
  const { linkStore } = loadShortLinkModules(platformContent);
  const meetingId = "00000000-0000-4000-8000-000000000002";
  const token = "a".repeat(64);

  // 1. Expired link
  const expired = await linkStore.createMeetingCheckInShortLink({ platformContent }, {
    clubId: CLUB_ID, meetingId, token, createdAt: new Date(Date.now() - 120000), expiresAt: new Date(Date.now() - 60000),
  });
  const expiredResult = await linkStore.resolveShortLink({ platformContent }, expired.code);
  assert.equal(expiredResult.status, "expired");
  assert.match(expiredResult.message, /expired/i);

  // 2. Closing check-in revokes the live link and removes the raw token
  const active = await linkStore.createMeetingCheckInShortLink({ platformContent }, {
    clubId: CLUB_ID, meetingId, token, createdAt: new Date(), expiresAt: new Date(Date.now() + 60000),
  });
  assert.equal((await linkStore.resolveShortLink({ platformContent }, active.code)).status, "valid");
  await linkStore.closeMeetingCheckInShortLinks({ platformContent }, meetingId);
  const closed = await linkStore.resolveShortLink({ platformContent }, active.code);
  assert.equal(closed.status, "revoked");
  assert.match(closed.message, /closed by the host/);
  assert.ok(![...store.values()].some((row) => JSON.stringify(row.value).includes(token) && !row.value.revoked && row.value.expiresAt > new Date().toISOString()));
  assert.ok(!JSON.stringify(store.get(`shortlink:${active.code}`).value).includes(token));

  // 3. Stale links for the meeting are deleted; other meetings are untouched
  const other = await linkStore.createMeetingCheckInShortLink({ platformContent }, {
    clubId: CLUB_ID, meetingId: "00000000-0000-4000-8000-000000000003", token, createdAt: new Date(), expiresAt: new Date(Date.now() + 60000),
  });
  await linkStore.deleteStaleMeetingCheckInShortLinks({ platformContent }, meetingId, new Date(Date.now() + 1000));
  assert.equal(store.has(`shortlink:${expired.code}`), false);
  assert.equal(store.has(`shortlink:${active.code}`), false);
  assert.equal(store.has(`shortlink:${other.code}`), true);
});

test("14. Authentication and authorization are strictly preserved during check-in", async () => {
  const clubId = "00000000-0000-4000-8000-000000000001";
  const meetingId = "00000000-0000-4000-8000-000000000002";
  let authenticatedUser = null;

  const mockPrisma = {
    meeting: {
      findUnique: async () => ({ id: meetingId, clubId, isPublic: false, audience: "MEMBERS" }),
    },
    clubMember: {
      findUnique: async () => null, // Not a member
    },
    $transaction: async (fn) => fn(mockPrisma),
    $queryRaw: async () => [],
  };

  const meetingsAction = load("actions/meetings.ts", {
    "@/utils/prisma": { prisma: mockPrisma },
    "@/utils/auth": {
      requireAuth: async () => {
        if (!authenticatedUser) throw new Error("Authentication required.");
        return { user: authenticatedUser };
      },
    },
    "@/lib/club-suspension": {
      assertClubOperational: async () => {},
      lockOperationalClub: async () => {},
    },
  });

  // 1. Unauthenticated request rejected
  await assert.rejects(
    meetingsAction.checkInMeeting(meetingId, "a".repeat(64)),
    /Authentication required/,
  );

  // 2. Non-member request rejected
  authenticatedUser = { id: "outsider-student" };
  await assert.rejects(
    meetingsAction.checkInMeeting(meetingId, "a".repeat(64)),
    /members only/,
  );
});

test("15. Duplicate attendance scans do not duplicate credits or change timestamps", async () => {
  const clubId = "00000000-0000-4000-8000-000000000001";
  const meetingId = "00000000-0000-4000-8000-000000000002";
  const originalTimestamp = new Date("2026-11-04T10:00:00.000Z");
  const attendances = [];

  const mockPrisma = {
    meeting: {
      findUnique: async () => ({ id: meetingId, clubId, isPublic: true, audience: "RECRUITMENT" }),
    },
    clubMember: {
      findUnique: async () => ({ permissions: ["meetings.attendance"] }),
    },
    user: {
      findUnique: async () => ({ disabledAt: null }),
    },
    meetingCheckInToken: {
      findFirst: async () => ({ meetingId, issuedBy: "leader-id" }),
    },
    eventAttendance: {
      findUnique: async () => attendances[0] || null,
      create: async ({ data }) => {
        const row = { ...data, checkedInAt: originalTimestamp };
        attendances.push(row);
        return row;
      },
    },
    $transaction: async (fn) => fn(mockPrisma),
    $queryRaw: async () => [],
  };

  const meetingsAction = load("actions/meetings.ts", {
    "@/utils/prisma": { prisma: mockPrisma },
    "@/utils/auth": {
      requireAuth: async () => ({ user: { id: "student-123" } }),
    },
    "@/lib/club-suspension": {
      assertClubOperational: async () => {},
      lockOperationalClub: async () => {},
    },
    "next/cache": { revalidatePath: () => {} },
  });

  // First scan
  const first = await meetingsAction.checkInMeeting(meetingId, "a".repeat(64));
  assert.equal(first.status, "checked-in");
  assert.equal(first.checkedInAt, originalTimestamp.toISOString());

  // Second scan with same token
  const second = await meetingsAction.checkInMeeting(meetingId, "a".repeat(64));
  assert.equal(second.status, "already-checked-in");
  assert.equal(second.checkedInAt, originalTimestamp.toISOString());
  assert.equal(attendances.length, 1);
});

test("16. Invalid, manipulated, or unknown QR identifiers and open redirects fail safely", async () => {
  const { platformContent } = platformStore();
  const { linkStore } = loadShortLinkModules(platformContent);

  // Non-existent code
  const notFound = await linkStore.resolveShortLink({ platformContent }, "unknownCode123");
  assert.equal(notFound.status, "not-found");

  // Invalid characters / traversal
  const malformed = await linkStore.resolveShortLink({ platformContent }, "../../../etc/passwd");
  assert.equal(malformed.status, "not-found");

  // Open redirect prevention
  assert.equal(shortLinks.isValidRedirectTarget("https://evil-phishing-site.com"), false);
  assert.equal(shortLinks.isValidRedirectTarget("//evil.com/fake-login"), false);
  assert.equal(shortLinks.isValidRedirectTarget("/\\evil.com"), false);
  assert.equal(shortLinks.isValidRedirectTarget("javascript:alert(1)"), false);
  // Browsers strip tab/newline and normalize "\" to "/", turning these into //evil.com
  for (const bypass of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/ /evil.com", "/x\\..\\/evil.com", "/\u000b/evil.com", "/\u007f/evil.com"])
    assert.equal(shortLinks.isValidRedirectTarget(bypass), false, JSON.stringify(bypass));
  assert.equal(shortLinks.isValidRedirectTarget("/club/vvf"), true);
  assert.equal(shortLinks.isValidRedirectTarget("/check-in?meetingId=m1#token=abc"), true);
  assert.equal(shortLinks.isValidRedirectTarget("https://out-class.net/check-in"), true);

  // Local development hosts are not valid destinations in production
  const env = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.equal(shortLinks.isValidRedirectTarget("http://localhost:3000/check-in"), false);
    assert.equal(shortLinks.isValidRedirectTarget("http://127.0.0.1/check-in"), false);
    assert.equal(shortLinks.isValidRedirectTarget("https://out-class.net/check-in"), true);
    process.env.NODE_ENV = "development";
    assert.equal(shortLinks.isValidRedirectTarget("http://localhost:3000/check-in"), true);
  } finally {
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
  }
});

test("16b. The browser-callable short-link action requires a session and only shortens share destinations", async () => {
  // Signed out: rejected before any database access
  const signedOut = platformStore();
  const anonymous = loadShortLinkModules(signedOut.platformContent, null).shortLinksAction;
  await assert.rejects(anonymous.createShortLink({ target: VOTING_JOIN }), /Authentication required/);
  assert.equal(signedOut.store.size, 0);

  const { store, platformContent } = platformStore();
  const { shortLinksAction, linkStore } = loadShortLinkModules(platformContent);
  const rejected = [
    "/check-in?meetingId=m1#token=" + "a".repeat(64),
    "/settings",
    "/?next=/q/abc",
    "https://out-class.net/club/vvf",
    `/voting/${SESSION_ID}/join?next=//evil.com`,
    "/club/" + "a".repeat(200),
    "/club/vvf?x=1",
    "/club/\tvvf",
    "",
  ];
  for (const target of rejected)
    await assert.rejects(shortLinksAction.createShortLink({ target }), /cannot be shortened/, target);
  await assert.rejects(shortLinksAction.createShortLink(null), /cannot be shortened/);
  assert.equal(store.size, 0);

  // Client-supplied record fields are ignored: no expiry, scope, metadata or type spoofing
  const created = await shortLinksAction.createShortLink({
    target: `/voting/rooms/${SESSION_ID}?clubId=${CLUB_ID}&view=member`,
    type: "meeting-check-in",
    expiresAt: new Date(Date.now() + 1000),
    clubId: "spoofed",
    eventId: "spoofed",
    metadata: { blob: "x".repeat(100000) },
  });
  const { record } = await linkStore.resolveShortLink({ platformContent }, created.code);
  assert.equal(record.type, "vote");
  assert.equal(record.expiresAt, null);
  assert.equal(record.clubId, null);
  assert.equal(record.eventId, null);
  assert.deepEqual(record.metadata, {});
  assert.ok(JSON.stringify(store.get(`shortlink:${created.code}`).value).length < 1000);
  assert.equal((await shortLinksAction.createShortLink({ target: "/club/vvf" })).shortUrl.startsWith("/q/"), true);

  // Only createShortLink is browser-callable; resolution and revocation are server-only
  assert.deepEqual(Object.keys(shortLinksAction), ["createShortLink"]);
  assert.match(fs.readFileSync("lib/short-link-store.ts", "utf8").split("\n").find((l) => l.trim()) || "", /^\/\*\*/);
  assert.ok(!/^\s*["']use server["']/m.test(fs.readFileSync("lib/short-link-store.ts", "utf8")));
  assert.match(fs.readFileSync("app/q/[code]/page.tsx", "utf8"), /from "@\/lib\/short-link-store"/);
});

test("17. Reusable destinations share short links while check-in links are unique", async () => {
  const { platformContent } = platformStore();
  const { shortLinksAction, linkStore } = loadShortLinkModules(platformContent);

  // Permanent reusable destination: calling create twice for the same destination returns the SAME code
  const link1 = await shortLinksAction.createShortLink({ target: VOTING_JOIN });
  const link2 = await shortLinksAction.createShortLink({ target: VOTING_JOIN });
  assert.equal(link1.code, link2.code);

  // Rotating check-in links: every token produces a DISTINCT code
  const meetingId = "00000000-0000-4000-8000-000000000002";
  const window = { clubId: CLUB_ID, meetingId, createdAt: new Date(), expiresAt: new Date(Date.now() + 60000) };
  const checkIn1 = await linkStore.createMeetingCheckInShortLink({ platformContent }, { ...window, token: "1".repeat(64) });
  const checkIn2 = await linkStore.createMeetingCheckInShortLink({ platformContent }, { ...window, token: "2".repeat(64) });
  assert.notEqual(checkIn1.code, checkIn2.code);
});
