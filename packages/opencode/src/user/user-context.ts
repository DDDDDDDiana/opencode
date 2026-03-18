import { Context } from "../util/context"
import type { UserID } from "./schema"

export type Authenticated = {
  state: "authenticated"
  user_id: UserID
}

export type Identity = Authenticated

const ctx = Context.create<Identity>("user")

export const UserContext = {
  provide<R>(identity: Identity, fn: () => R): R {
    return ctx.provide(identity, fn)
  },

  get(): Identity {
    return ctx.use()
  },

  get userID(): UserID {
    return UserContext.get().user_id
  },
}
