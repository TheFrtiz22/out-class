// OutClass has one palette (styles/tokens.css). Components must use semantic
// tokens (bg-background, text-muted-foreground, var(--border), ...) rather than
// Tailwind's neutral ramps or hard-coded hex colors.
const RAMP = /(?<![\w-])((?:[a-z][\w-]*:)*!?-?[a-z][a-z-]*-(?:neutral|gray|slate|zinc|stone)-(?:50|[1-9]00|950)(?:\/(?:\d{1,3}|\[[^\]]+\]))?)(?![\w-])/g;
const HEX = /(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
// Attributes whose values are URLs or ids, where "#abc" is a fragment, not a color.
const FRAGMENT_ATTRIBUTES = new Set(["href", "to", "id", "htmlFor", "xlinkHref", "aria-controls", "aria-describedby", "aria-labelledby"]);

// DOM lookups take CSS selectors, where "#add" is an id, not a color.
const SELECTOR_CALLS = new Set(["querySelector", "querySelectorAll", "closest", "matches", "getElementById"])
function isSelectorArgument(node) {
  let current = node
  while (current.parent?.type === "TemplateLiteral" || current.parent?.type === "BinaryExpression") current = current.parent
  const call = current.parent
  if (call?.type !== "CallExpression" || !call.arguments.includes(current)) return false
  const name = call.callee.type === "MemberExpression" ? call.callee.property?.name : call.callee.name
  return SELECTOR_CALLS.has(name)
}

function isFragmentAttribute(node) {
  let current = node.parent;
  while (current && current.type !== "JSXAttribute" && current.type !== "Program" && current.type !== "JSXElement") current = current.parent;
  return current?.type === "JSXAttribute" && FRAGMENT_ATTRIBUTES.has(current.name?.name);
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow Tailwind neutral/gray/slate/zinc/stone color utilities and hex color literals; use OutClass tokens." },
    messages: {
      ramp: "Use an OutClass semantic token instead of the Tailwind color utility `{{value}}`.",
      hex: "Use an OutClass token (var(--…)) instead of the hex color `{{value}}`.",
    },
    schema: [],
  },
  create(context) {
    function check(node, text) {
      if (typeof text !== "string" || !text) return;
      for (const match of text.matchAll(RAMP)) context.report({ node, messageId: "ramp", data: { value: match[1] } });
      if (/#/.test(text) && !isFragmentAttribute(node) && !isSelectorArgument(node)) for (const match of text.matchAll(HEX)) context.report({ node, messageId: "hex", data: { value: match[0] } });
    }
    return {
      Literal(node) { check(node, node.value); },
      TemplateElement(node) { check(node, node.value.cooked ?? node.value.raw); },
    };
  },
};

export default { meta: { name: "outclass" }, rules: { "no-raw-colors": rule } };
