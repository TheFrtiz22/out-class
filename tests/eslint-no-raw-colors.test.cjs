const { test } = require("node:test")
const { RuleTester } = require("eslint")

test("outclass/no-raw-colors flags neutral ramps and hex colors, not tokens or fragments", async () => {
  const { default: plugin } = await import("../eslint-rules/no-raw-colors.mjs")
  const tester = new RuleTester({ languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } })
  tester.run("no-raw-colors", plugin.rules["no-raw-colors"], {
    valid: [
      `<div className="bg-background text-muted-foreground border-border" />`,
      `<a href="#add">Add</a>`,
      `<a href="/club#face">Club</a>`,
      `<button aria-controls="#bad" />`,
      `const style = { color: "var(--foreground)" }`,
      `<div className="grayscale text-gray" />`,
    ],
    invalid: [
      { code: `<div className="bg-neutral-100 text-sm" />`, errors: [{ messageId: "ramp" }] },
      { code: `<div className="hover:border-slate-300/60 md:text-zinc-950" />`, errors: [{ messageId: "ramp" }, { messageId: "ramp" }] },
      { code: "<div className={`${a} ring-stone-200 divide-gray-50`} />", errors: [{ messageId: "ramp" }, { messageId: "ramp" }] },
      { code: `const style = { color: "#fff", background: "#14243A" }`, errors: [{ messageId: "hex" }, { messageId: "hex" }] },
      { code: `<div className="bg-[#f6f5f1]" />`, errors: [{ messageId: "hex" }] },
      { code: `<svg><path fill="#e8793e80" /></svg>`, errors: [{ messageId: "hex" }] },
    ],
  })
})
