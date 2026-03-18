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

describe("session part ownership", () => {
  let ownerKey: string
  let ownerUserID: string
  let ownerSession: string
  let otherKey: string
  let msgID: MessageID
  let partID: PartID

  beforeAll(async () => {
    await Instance.provide({
      directory: root,
      fn: async () => {
        const owner = await User.create({ name: "owner" })
        ownerKey = owner.apiKey
        ownerUserID = owner.user.id

        const other = await User.create({ name: "other" })
        otherKey = other.apiKey

        const session = await UserContext.provide({ state: "authenticated", user_id: owner.user.id }, async () => {
          return await Session.create({})
        })
        ownerSession = session.id

        msgID = MessageID.ascending()
        partID = PartID.ascending()
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
            id: partID,
            sessionID: session.id,
            messageID: msgID,
            type: "text",
            text: "test part",
          })
        })
      },
    })
  })

  test("different user gets 404 when deleting another user's message", async () => {
    await Instance.provide({
      directory: root,
      fn: async () => {
        const app = Server.Default()
        const res = await app.request(`/session/${ownerSession}/message/${msgID}`, {
          method: "DELETE",
          headers: { "x-opencode-api-key": otherKey },
        })
        expect(res.status).toBe(404)

        const verify = await app.request(`/session/${ownerSession}/message`, {
          headers: { "x-opencode-api-key": ownerKey },
        })
        expect(verify.status).toBe(200)
        const msgs = await verify.json()
        expect(msgs.some((m: any) => m.info.id === msgID)).toBe(true)
      },
    })
  })

  test("different user gets 404 when deleting or patching another user's part", async () => {
    await Instance.provide({
      directory: root,
      fn: async () => {
        const app = Server.Default()

        const delRes = await app.request(`/session/${ownerSession}/message/${msgID}/part/${partID}`, {
          method: "DELETE",
          headers: { "x-opencode-api-key": otherKey },
        })
        expect(delRes.status).toBe(404)

        const patchRes = await app.request(`/session/${ownerSession}/message/${msgID}/part/${partID}`, {
          method: "PATCH",
          headers: { "x-opencode-api-key": otherKey, "content-type": "application/json" },
          body: JSON.stringify({
            id: partID,
            sessionID: ownerSession,
            messageID: msgID,
            type: "text",
            text: "hacked",
          }),
        })
        expect(patchRes.status).toBe(404)
      },
    })
  })

  test("anonymous caller can read part-bearing data from legacy anonymous session", async () => {
    await Instance.provide({
      directory: root,
      fn: async () => {
        const anonSession = await Session.create({})
        const anonMsgID = MessageID.ascending()
        const anonPartID = PartID.ascending()
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
        await Session.updatePart({
          id: anonPartID,
          sessionID: anonSession.id,
          messageID: anonMsgID,
          type: "text",
          text: "anon part",
        })

        const app = Server.Default()
        const res = await app.request(`/session/${anonSession.id}/message/${anonMsgID}`)
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.parts.length).toBeGreaterThan(0)
      },
    })
  })
})
