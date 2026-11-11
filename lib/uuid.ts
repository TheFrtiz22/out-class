// The same strings zod 3's `z.string().uuid()` accepts (any version nibble, either case, hyphenated,
// nothing around it), for client code that only needs this one check and should not ship zod.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)
