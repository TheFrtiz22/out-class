import { z } from "zod"

/**
 * Shape limits checked on raw, untrusted input before a schema sees it.
 *
 * Schema validation visits every array element even when the array is longer
 * than its `.max()`, so an oversized array costs work and memory in proportion
 * to its length before it is rejected. `boundedParse` measures the raw value
 * first (iteratively, stopping at the first limit exceeded) and only then runs
 * the schema. Rejections are ordinary `z.ZodError`s, so callers keep their
 * existing validation-error handling.
 */
export type BoundedInputLimits = {
  /** Longest array, Set or Map allowed anywhere in the value. */
  maxArrayLength?: number
  /** Sum of the lengths of every array, Set and Map in the value. */
  maxTotalElements?: number
  /** Deepest object/array nesting allowed. */
  maxDepth?: number
  /** Approximate serialized size, in characters. */
  maxBytes?: number
}
type Limits = Required<BoundedInputLimits>

export const DEFAULT_MAX_ARRAY_LENGTH = 1000
export const DEFAULT_MAX_DEPTH = 64
/** Matches the Server Action body limit in next.config.mjs. */
export const DEFAULT_MAX_BYTES = 12 * 1024 * 1024
/** Ceiling for derived element totals; an explicit `maxTotalElements` may exceed it. */
export const MAX_DERIVED_TOTAL_ELEMENTS = 100_000

const defaults: Limits = { maxArrayLength: DEFAULT_MAX_ARRAY_LENGTH, maxTotalElements: 10 * DEFAULT_MAX_ARRAY_LENGTH, maxDepth: DEFAULT_MAX_DEPTH, maxBytes: DEFAULT_MAX_BYTES }

type Path = (string | number)[]
function issue(path: Path, message: string): z.ZodIssue {
  return { code: z.ZodIssueCode.custom, path, message }
}

function isPlainObject(value: object) {
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

type Def = { typeName?: string; [key: string]: unknown }
const defOf = (schema: z.ZodTypeAny) => schema._def as Def
type Step = { parent: Step | null; key: string | number } | null
const pathOf = (step: Step): Path => { const path: Path = []; for (let at = step; at; at = at.parent) path.unshift(at.key); return path }
/**
 * How the schema treats a value: a schema node to follow, `undefined` when the
 * shape is not known here (unions, `z.any()`, preprocessing) and generic
 * limits apply, or "extra" for keys a stripping object drops without visiting.
 */
type Guide = z.ZodTypeAny | undefined | "extra"
type Frame = { value: unknown; guide: Guide; depth: number; at: Step } | { exit: object }

/** Follows wrappers to the schema that will see `value`; `undefined` when unknown. */
function resolveGuide(schema: z.ZodTypeAny | undefined, value: unknown): z.ZodTypeAny | undefined {
  for (let hops = 0; schema && hops < 32; hops++) {
    const def = defOf(schema)
    switch (def.typeName) {
      case "ZodOptional": case "ZodNullable": case "ZodDefault": case "ZodCatch": case "ZodReadonly": schema = def.innerType as z.ZodTypeAny; break
      case "ZodBranded": schema = def.type as z.ZodTypeAny; break
      case "ZodEffects": if ((def.effect as { type?: string } | undefined)?.type === "preprocess") return undefined; schema = def.schema as z.ZodTypeAny; break
      case "ZodPipeline": schema = def.in as z.ZodTypeAny; break
      case "ZodLazy": schema = (def.getter as () => z.ZodTypeAny)(); break
      case "ZodDiscriminatedUnion": {
        if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined
        schema = (def.optionsMap as Map<unknown, z.ZodTypeAny>).get((value as Record<string, unknown>)[def.discriminator as string])
        break
      }
      case "ZodArray": case "ZodTuple": case "ZodSet": case "ZodMap": case "ZodObject": case "ZodRecord": return schema
      default: return undefined
    }
  }
  return undefined
}

/** Schema for a key the object schema does not declare. */
function undeclaredKey(def: Def): Guide {
  const catchall = def.catchall as z.ZodTypeAny | undefined
  if (catchall && defOf(catchall).typeName !== "ZodNever") return catchall
  // Stripped keys are never visited by the schema; strict and passthrough keep generic limits.
  return def.unknownKeys === "strip" ? "extra" : undefined
}

/**
 * Returns the first limit the raw value exceeds, or null. Never throws.
 *
 * Every visit is charged, so a subtree referenced from several places costs
 * what the schema will spend visiting it at each place. With `schema`, keys a
 * stripping object drops are walked only against the byte and depth caps.
 */
export function boundedInputIssue(value: unknown, limits: BoundedInputLimits = {}, schema?: z.ZodTypeAny): z.ZodIssue | null {
  const max = { ...defaults, ...limits }
  const stack: Frame[] = [{ value, guide: schema, depth: 0, at: null }]
  // Objects on the current path; reaching one again is a cycle.
  const ancestors = new Set<object>()
  // Stripped subtrees are measured once per object; the schema never visits them.
  const seenExtra = new Set<object>()
  let elements = 0
  let bytes = 0
  while (stack.length) {
    const frame = stack.pop()!
    if ("exit" in frame) { ancestors.delete(frame.exit); continue }
    const { value: current, depth, at } = frame
    const extra = frame.guide === "extra"
    if (typeof current === "string") bytes += current.length + 2
    else if (current === null || typeof current !== "object") bytes += 8
    else if (extra && seenExtra.has(current)) bytes += 8
    else {
      if (extra) seenExtra.add(current)
      else if (ancestors.has(current)) return issue(pathOf(at), "Input contains a circular reference.")
      if (depth >= max.maxDepth) return issue(pathOf(at), "Input is nested too deeply.")
      const guide = extra ? undefined : resolveGuide(frame.guide as z.ZodTypeAny | undefined, current)
      const def = guide ? defOf(guide) : undefined
      const child = (guideFor: Guide, item: unknown, key: string | number) => stack.push({ value: item, guide: extra ? "extra" : guideFor, depth: depth + 1, at: { parent: at, key } })
      const isSet = current instanceof Set, isMap = current instanceof Map
      const size = Array.isArray(current) ? current.length : isSet || isMap ? current.size : -1
      if (size >= 0) {
        if (!extra) {
          // Length is checked before any element is visited.
          // Same shape as the schema's own `.max()` issue, so callers see a familiar error.
          if (size > max.maxArrayLength) {
            if (isMap) return { code: z.ZodIssueCode.custom, path: pathOf(at), params: { type: "map", maximum: max.maxArrayLength }, message: `Map must contain at most ${max.maxArrayLength} entries` }
            return { code: z.ZodIssueCode.too_big, type: isSet ? "set" : "array", maximum: max.maxArrayLength, inclusive: true, exact: false, path: pathOf(at), message: `${isSet ? "Set" : "Array"} must contain at most ${max.maxArrayLength} element(s)` }
          }
          elements += size
          if (elements > max.maxTotalElements) return issue(pathOf(at), "Too many items.")
          ancestors.add(current)
          stack.push({ exit: current })
        }
        bytes += 2 + size
        if (Array.isArray(current)) {
          const items = def?.typeName === "ZodTuple" ? def.items as z.ZodTypeAny[] : null
          const element = def?.typeName === "ZodArray" ? def.type as z.ZodTypeAny : undefined
          for (let i = 0; i < size; i++) child(items ? items[i] ?? (def!.rest as z.ZodTypeAny | null) ?? undefined : element, current[i], i)
        } else if (isSet) { const item = def?.typeName === "ZodSet" ? def.valueType as z.ZodTypeAny : undefined; let i = 0; for (const entry of current) child(item, entry, i++) }
        else {
          const [keyType, valueType] = def?.typeName === "ZodMap" ? [def.keyType as z.ZodTypeAny, def.valueType as z.ZodTypeAny] : [undefined, undefined]
          let i = 0; for (const [key, item] of current as Map<unknown, unknown>) { child(keyType, key, i); child(valueType, item, i++) }
        }
      } else if (isPlainObject(current)) {
        if (!extra) { ancestors.add(current); stack.push({ exit: current }) }
        bytes += 2
        const shape = def?.typeName === "ZodObject" ? (guide as z.AnyZodObject).shape as Record<string, z.ZodTypeAny> : null
        const record = def?.typeName === "ZodRecord" ? def.valueType as z.ZodTypeAny : undefined
        for (const key in current) {
          if (!Object.prototype.hasOwnProperty.call(current, key)) continue
          bytes += key.length + 4
          if (bytes > max.maxBytes) return issue(pathOf(at), "Input is too large.")
          child(shape ? Object.prototype.hasOwnProperty.call(shape, key) ? shape[key] : undeclaredKey(def!) : record, (current as Record<string, unknown>)[key], key)
        }
      } else bytes += 8 // Date, File, Blob and other opaque values are leaves.
    }
    if (bytes > max.maxBytes) return issue([], "Input is too large.")
  }
  return null
}

/** Throws a `z.ZodError` when the raw value exceeds the limits. */
export function assertBoundedInput(value: unknown, limits: BoundedInputLimits = {}, schema?: z.ZodTypeAny): void {
  const found = boundedInputIssue(value, limits, schema)
  if (found) throw new z.ZodError([found])
}

const derived = new WeakMap<z.ZodTypeAny, Limits>()

/**
 * Limits implied by a schema: the longest array it accepts (its largest
 * `.max()`/tuple length, or the default when an array is unbounded) and the
 * most elements a valid value can hold in total. Valid input always fits.
 */
export function inputLimitsFor(schema: z.ZodTypeAny): Limits {
  const cached = derived.get(schema)
  if (cached) return cached
  let longest = 0
  const visiting = new Set<z.ZodTypeAny>()
  const length = (n: number | undefined | null) => {
    const value = typeof n === "number" ? n : DEFAULT_MAX_ARRAY_LENGTH
    longest = Math.max(longest, value)
    return value
  }
  // Upper bound on the total array/Set/Map elements a valid value can contain.
  const capacity = (s: z.ZodTypeAny | undefined): number => {
    if (!s || visiting.has(s)) return s ? DEFAULT_MAX_ARRAY_LENGTH : 0
    visiting.add(s)
    try {
      const def = s._def as Def
      const inner = (key: string) => capacity(def[key] as z.ZodTypeAny)
      switch (def.typeName) {
        case "ZodArray": {
          const n = length((def.exactLength as { value: number } | null)?.value ?? (def.maxLength as { value: number } | null)?.value)
          return n + n * inner("type")
        }
        case "ZodSet": { const n = length((def.maxSize as { value: number } | null)?.value); return n + n * inner("valueType") }
        case "ZodMap": { const n = length(undefined); return n + n * (inner("keyType") + inner("valueType")) }
        case "ZodTuple": {
          const items = def.items as z.ZodTypeAny[]
          const rest = def.rest ? length(undefined) * (1 + inner("rest")) : 0
          length(items.length)
          return items.length + items.reduce((sum, item) => sum + capacity(item), 0) + rest
        }
        case "ZodObject": {
          const shape = (s as z.AnyZodObject).shape as Record<string, z.ZodTypeAny>
          const catchall = def.catchall as z.ZodTypeAny | undefined
          const extra = catchall && (catchall._def as Def).typeName !== "ZodNever" ? DEFAULT_MAX_ARRAY_LENGTH * capacity(catchall) : 0
          return Object.values(shape).reduce((sum, field) => sum + capacity(field), 0) + extra
        }
        case "ZodRecord": return DEFAULT_MAX_ARRAY_LENGTH * inner("valueType")
        case "ZodUnion": case "ZodDiscriminatedUnion": {
          const options = (def.options instanceof Map ? [...def.options.values()] : def.options) as z.ZodTypeAny[]
          return Math.max(0, ...options.map(capacity))
        }
        case "ZodIntersection": return inner("left") + inner("right")
        case "ZodEffects": return inner("schema")
        case "ZodPipeline": return Math.max(inner("in"), inner("out"))
        case "ZodLazy": return capacity((def.getter as () => z.ZodTypeAny)())
        case "ZodBranded": case "ZodPromise": return inner("type")
        case "ZodOptional": case "ZodNullable": case "ZodDefault": case "ZodCatch": case "ZodReadonly": return inner("innerType")
        // Unvalidated values (for example rich-text JSON) are not walked by the
        // schema; leave them room within the default per-array length.
        case "ZodAny": case "ZodUnknown": length(undefined); return 10 * DEFAULT_MAX_ARRAY_LENGTH
        default: return 0
      }
    } finally {
      visiting.delete(s)
    }
  }
  const total = capacity(schema)
  const maxArrayLength = longest || DEFAULT_MAX_ARRAY_LENGTH
  const limits: Limits = { ...defaults, maxArrayLength, maxTotalElements: Math.min(MAX_DERIVED_TOTAL_ELEMENTS, Math.max(total, maxArrayLength)) }
  derived.set(schema, limits)
  return limits
}

/** `schema.parse(value)` after checking the raw value against the schema's limits (or explicit overrides). */
export function boundedParse<T extends z.ZodTypeAny>(schema: T, value: unknown, limits: BoundedInputLimits = {}): z.output<T> {
  assertBoundedInput(value, { ...inputLimitsFor(schema), ...limits }, schema)
  return schema.parse(value)
}

/** `schema.safeParse(value)` with the same pre-check; an oversized value yields `{ success: false }`. */
export function boundedSafeParse<T extends z.ZodTypeAny>(schema: T, value: unknown, limits: BoundedInputLimits = {}): z.SafeParseReturnType<z.input<T>, z.output<T>> {
  const found = boundedInputIssue(value, { ...inputLimitsFor(schema), ...limits }, schema)
  if (found) return { success: false, error: new z.ZodError([found]) }
  return schema.safeParse(value)
}
