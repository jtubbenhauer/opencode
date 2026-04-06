import { afterEach, describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { Permission } from "../../src/permission"
import { Question } from "../../src/question"
import { SessionID, MessageID } from "../../src/session/schema"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

afterEach(async () => {
  await Instance.disposeAll()
})

describe("GET /permission", () => {
  test("returns empty array when no pending permissions", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const app = Server.Default()
        const res = await app.request(`/permission?directory=${encodeURIComponent(tmp.path)}`)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([])
      },
    })
  })

  test("returns pending permission requests", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sid = SessionID.make("ses_test")
        const ask = Permission.ask({
          sessionID: sid,
          permission: "bash",
          patterns: ["ls"],
          metadata: { cmd: "ls" },
          always: ["ls"],
          tool: { messageID: MessageID.make("msg_test"), callID: "call_test" },
          ruleset: [],
        })

        const app = Server.Default()
        const res = await app.request(`/permission?directory=${encodeURIComponent(tmp.path)}`)
        expect(res.status).toBe(200)

        const data = await res.json()
        expect(data).toHaveLength(1)
        expect(data[0]).toMatchObject({
          sessionID: sid,
          permission: "bash",
          patterns: ["ls"],
        })

        for (const req of data) {
          await Permission.reply({ requestID: req.id, reply: "reject" })
        }
        await ask.catch(() => {})
      },
    })
  })
})

describe("GET /question", () => {
  test("returns empty array when no pending questions", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const app = Server.Default()
        const res = await app.request(`/question?directory=${encodeURIComponent(tmp.path)}`)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([])
      },
    })
  })

  test("returns pending question requests", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const sid = SessionID.make("ses_test")
        const ask = Question.ask({
          sessionID: sid,
          questions: [
            {
              question: "Pick something?",
              header: "Choice",
              options: [
                { label: "A", description: "Option A" },
                { label: "B", description: "Option B" },
              ],
            },
          ],
        })

        const app = Server.Default()
        const res = await app.request(`/question?directory=${encodeURIComponent(tmp.path)}`)
        expect(res.status).toBe(200)

        const data = await res.json()
        expect(data).toHaveLength(1)
        expect(data[0]).toMatchObject({
          sessionID: sid,
          questions: [
            {
              question: "Pick something?",
              header: "Choice",
            },
          ],
        })

        await Question.reject(data[0].id)
        await ask.catch(() => {})
      },
    })
  })
})
