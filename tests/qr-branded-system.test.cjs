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

test("11. Short-link generation and resolution produces valid compact links", async () => {
  const store = new Map();
  const mockPrisma = {
    platformContent: {
      findUnique: async ({ where }) => store.get(where.key) || null,
      create: async ({ data }) => {
        store.set(data.key, data);
        return data;
      },
      update: async ({ where, data }) => {
        const item = store.get(where.key);
        Object.assign(item, data);
        return item;
      },
      upsert: async ({ where, update, create }) => {
        const existing = store.get(where.key);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        store.set(where.key, create);
        return create;
      },
    },
  };

  const shortLinksAction = load("actions/short-links.ts", {
    "@/utils/prisma": { prisma: mockPrisma },
  });

  const created = await shortLinksAction.createShortLink({
    target: "/club/vvf",
    type: "club",
    reusable: true,
  });

  assert.match(created.code, /^[a-zA-Z0-9]{6,8}$/);
  assert.equal(created.shortUrl, `/q/${created.code}`);

  const resolved = await shortLinksAction.resolveShortLink(created.code);
  assert.equal(resolved.status, "valid");
  assert.equal(resolved.target, "/club/vvf");
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

test("13. Expired and revoked short links fail resolution with clear status", async () => {
  const store = new Map();
  const mockPrisma = {
    platformContent: {
      findUnique: async ({ where }) => store.get(where.key) || null,
      create: async ({ data }) => {
        store.set(data.key, data);
        return data;
      },
      update: async ({ where, data }) => {
        const item = store.get(where.key);
        Object.assign(item, data);
        return item;
      },
    },
  };

  const shortLinksAction = load("actions/short-links.ts", {
    "@/utils/prisma": { prisma: mockPrisma },
  });

  // 1. Expired link
  const expiredLink = await shortLinksAction.createShortLink({
    target: "/check-in?meetingId=expired-meeting",
    type: "meeting-check-in",
    expiresAt: new Date(Date.now() - 60000), // 1 minute in the past
  });

  const expiredResult = await shortLinksAction.resolveShortLink(expiredLink.code);
  assert.equal(expiredResult.status, "expired");
  assert.match(expiredResult.message, /expired/i);

  // 2. Revoked link
  const activeLink = await shortLinksAction.createShortLink({
    target: "/check-in?meetingId=closed-meeting",
    type: "meeting-check-in",
    expiresAt: new Date(Date.now() + 60000),
  });

  await shortLinksAction.revokeShortLink(activeLink.code, "Check-in closed by proctor.");
  const revokedResult = await shortLinksAction.resolveShortLink(activeLink.code);
  assert.equal(revokedResult.status, "revoked");
  assert.equal(revokedResult.message, "Check-in closed by proctor.");
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
  const store = new Map();
  const mockPrisma = {
    platformContent: {
      findUnique: async ({ where }) => store.get(where.key) || null,
    },
  };

  const shortLinksAction = load("actions/short-links.ts", {
    "@/utils/prisma": { prisma: mockPrisma },
  });

  // Non-existent code
  const notFound = await shortLinksAction.resolveShortLink("unknownCode123");
  assert.equal(notFound.status, "not-found");

  // Invalid characters / traversal
  const malformed = await shortLinksAction.resolveShortLink("../../../etc/passwd");
  assert.equal(malformed.status, "not-found");

  // Open redirect prevention
  assert.equal(shortLinks.isValidRedirectTarget("https://evil-phishing-site.com"), false);
  assert.equal(shortLinks.isValidRedirectTarget("//evil.com/fake-login"), false);
  assert.equal(shortLinks.isValidRedirectTarget("/\\evil.com"), false);
  assert.equal(shortLinks.isValidRedirectTarget("javascript:alert(1)"), false);
  assert.equal(shortLinks.isValidRedirectTarget("/club/vvf"), true);
  assert.equal(shortLinks.isValidRedirectTarget("https://out-class.net/check-in"), true);
});

test("17. Reusable destinations share short links while temporary links are unique", async () => {
  const store = new Map();
  const mockPrisma = {
    platformContent: {
      findUnique: async ({ where }) => store.get(where.key) || null,
      create: async ({ data }) => {
        store.set(data.key, data);
        return data;
      },
      upsert: async ({ where, update, create }) => {
        const existing = store.get(where.key);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        store.set(where.key, create);
        return create;
      },
    },
  };

  const shortLinksAction = load("actions/short-links.ts", {
    "@/utils/prisma": { prisma: mockPrisma },
  });

  // Permanent reusable destination: calling create twice for the same destination returns the SAME code
  const clubLink1 = await shortLinksAction.createShortLink({
    target: "/club/vvf",
    reusable: true,
  });
  const clubLink2 = await shortLinksAction.createShortLink({
    target: "/club/vvf",
    reusable: true,
  });
  assert.equal(clubLink1.code, clubLink2.code);

  // Temporary check-in links: calling create for rotating tokens produces DISTINCT codes
  const checkIn1 = await shortLinksAction.createShortLink({
    target: "/check-in?meetingId=m1#token=" + "1".repeat(64),
    expiresAt: new Date(Date.now() + 60000),
  });
  const checkIn2 = await shortLinksAction.createShortLink({
    target: "/check-in?meetingId=m1#token=" + "2".repeat(64),
    expiresAt: new Date(Date.now() + 60000),
  });
  assert.notEqual(checkIn1.code, checkIn2.code);
});
