import type { Identity } from "./user-context"

// @ts-expect-error - Identity is not a union type, cannot check for "anonymous"
const _test1: Identity = { state: "anonymous" }

// @ts-expect-error - Identity only has "authenticated" state
const _test2 = (id: Identity) => id.state === "anonymous"
