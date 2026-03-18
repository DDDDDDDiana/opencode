import { describe, test, expect, beforeAll } from "bun:test"
import path from "path"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { User } from "../../src/user"
import { Session } from "../../src/session"
import { UserContext } from "../../src/user/user-context"
import { MessageV2 } from "../../src/session/message-v2"
import { MessageID, PartID } from "../../src/session/schema"
import { Log } from "../../src/util/log"

const root = path.join(__dirname, "../..")
Log.init({ print: false })

describe("session message ownership", () => {
  let ownerKey: string
  let ownerSession: string
  let otherKey: string
  let msgID: MessageID

  beforeAll(async () => {
    await Instance.provide({
      directory: root,
      fn: async () => {
        const owner = await User.create({ name: "owner" })
        ownerKey = owner.apiKey

        const other = await User.create({ name: "other" })
        otherKey = other.apiKey

        const session = await UserContext.provide({ state: "authenticated", user_id: owner.user.id }, async () => {
          return await Session.create({})
        })
        ownerSession = session.id

        msgID = MessageID.ascending()
        await UserContext.provide({ state: "authenticated", user_id: owner.user.id }, async () => {
          await Session.updateMessage({
            id: msgID,
            sessionID: session.id,
            role: "user",
            time: { created: Date.now() },
            agent: "test",
            model: { providerID: "test", modelID: "test" },
            tools: {},
            mode: "",
          } as unknown as MessageV2.Info)
          await Session.updatePart({
            id: PartID.ascending(),
            sessionID: session.id,
            messageID: msgID,
            type: "text",
            text: "test part",
          })
        })
      },
    })
  })

  test("owner can load paginated message history", async () => {
    await Instance.provide({
      directory: root,
      fn: async () => {
        const app = Server.Default()
        const res = await app.request(`/session/${ownerSession}/message?limit=10`, {
          headers: { "x-opencode-api-key": ownerKey },
        })
        expect(res.status).toBe(200)
        const messages = await res.json()
        expect(messages.length).toBeGreaterThan(0)
      },
    })
  })

  test("different user gets 404 from paginated and single message reads", async () => {
    await Instance.provide({
      directory: root,
      fn: async () => {
        const app = Server.Default()

        const paginated = await app.request(`/session/${ownerSession}/message?limit=10`, {
          headers: { "x-opencode-api-key": otherKey },
        })
        expect(paginated.status).toBe(404)

        const single = await app.request(`/session/${ownerSession}/message/${msgID}`, {
          headers: { "x-opencode-api-key": otherKey },
        })
        expect(single.status).toBe(404)
      },
    })
  })

  test("anonymous caller can read legacy anonymous session messages", async () => {
    await Instance.provide({
      directory: root,
      fn: async () => {
        const anonSession = await Session.create({})
        const anonMsgID = MessageID.ascending()
        await Session.updateMessage({
          id: anonMsgID,
          sessionID: anonSession.id,
          role: "user",
          time: { created: Date.now() },
          agent: "test",
          model: { providerID: "test", modelID: "test" },
          tools: {},
          mode: "",
        } as unknown as MessageV2.Info)

        const app = Server.Default()
        const res = await app.request(`/session/${anonSession.id}/message?limit=10`)
        expect(res.status).toBe(200)
        const messages = await res.json()
        expect(messages.length).toBeGreaterThan(0)
      },
    })
  })
})
