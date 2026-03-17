import { Context } from "../util/context"
import type { UserID } from "./schema"

export type Authenticated = {
  state: "authenticated"
  user_id: UserID
}

export type Anonymous = {
  state: "anonymous"
  reason: "missing" | "invalid"
}

export type Identity = Authenticated | Anonymous

const ANONYMOUS_MISSING: Anonymous = { state: "anonymous", reason: "missing" }

const ctx = Context.create<Identity>("user")

export const UserContext = {
  provide<R>(identity: Identity, fn: () => R): R {
    return ctx.provide(identity, fn)
  },

  get(): Identity {
    try {
      return ctx.use()
    } catch {
      return ANONYMOUS_MISSING
    }
  },

  get userID(): UserID | undefined {
    const id = UserContext.get()
    return id.state === "authenticated" ? id.user_id : undefined
  },

  get authenticated(): boolean {
    return UserContext.get().state === "authenticated"
  },
}
