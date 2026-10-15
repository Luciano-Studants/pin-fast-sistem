/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest"

const hoisted = vi.hoisted(() => {
  class FakeApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
      public readonly code?: string,
    ) {
      super(message)
    }
  }
  return {
    FakeApiError,
    calls: [] as Array<{ path: string; method: string; body: any }>,
    state: { handler: (_path: string, _method: string, _body: any): any => ({}) },
  }
})
const { FakeApiError, calls, state } = hoisted

vi.mock("../../apiClient", () => ({
  ApiError: hoisted.FakeApiError,
  apiRequest: vi.fn(async (path: string, options: any = {}) => {
    const method = options.method ?? "GET"
    hoisted.calls.push({ path, method, body: options.body })
    return hoisted.state.handler(path, method, options.body)
  }),
}))

const memory = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size
  },
}

import * as store from "../../store/store"
import { delta, RESOURCES } from "../resources"
import { flushAll, hydrate, isDirty, startSync, stopSync } from "../engine"

const resource = (name: string) => RESOURCES.find((r) => r.name === name)!

beforeEach(() => {
  memory.clear()
  calls.length = 0
  state.handler = () => ({})
  stopSync()
  store.setScope("user-1")
  startSync()
})

describe("delta", () => {
  it("returns only changed fields", () => {
    expect(delta({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({ b: 2 })
    expect(delta({ a: 1 })).toEqual({ a: 1 })
  })
})

describe("coleções", () => {
  it("cria, atualiza só o que mudou e remove", async () => {
    const note = { id: "note-aaaaaaaa", content: "olá", color: "#fff", createdAt: "2026-01-01T00:00:00.000Z" }
    store.set("notes-v1", [note], { sync: false })
    expect(isDirty(resource("notes"))).toBe(true)

    await flushAll()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /notes"])
    expect(calls[0].body).toMatchObject({ id: note.id, content: "olá", title: null })
    expect(isDirty(resource("notes"))).toBe(false)

    calls.length = 0
    store.set("notes-v1", [{ ...note, content: "novo" }], { sync: false })
    await flushAll()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ method: "PATCH", path: "/notes/note-aaaaaaaa", body: { content: "novo" } })

    calls.length = 0
    store.set("notes-v1", [], { sync: false })
    await flushAll()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["DELETE /notes/note-aaaaaaaa"])
  })

  it("não reenvia quando nada mudou", async () => {
    store.set("links-v1", [{ id: "link-aaaaaaaa", name: "A", url: "https://a.com" }], { sync: false })
    await flushAll()
    calls.length = 0
    await flushAll()
    expect(calls).toHaveLength(0)
  })

  it("cai para PATCH quando o POST responde 409", async () => {
    state.handler = (_path, method) => {
      if (method === "POST") throw new FakeApiError(409, "dup")
      return {}
    }
    store.set("notes-v1", [{ id: "note-bbbbbbbb", content: "x", color: "#fff", createdAt: "" }], { sync: false })
    await flushAll()
    expect(calls.map((c) => c.method)).toEqual(["POST", "PATCH"])
    expect(isDirty(resource("notes"))).toBe(false)
  })

  it("mantém pendente e tenta depois em erro de rede", async () => {
    vi.useFakeTimers()
    state.handler = () => {
      throw new TypeError("Failed to fetch")
    }
    store.set("notes-v1", [{ id: "note-cccccccc", content: "x", color: "#fff", createdAt: "" }], { sync: false })
    await flushAll()
    expect(isDirty(resource("notes"))).toBe(true)
    vi.useRealTimers()
  })

  it("descarta recusa permanente (400) sem repetir para sempre", async () => {
    state.handler = () => {
      throw new FakeApiError(400, "inválido")
    }
    store.set("notes-v1", [{ id: "note-dddddddd", content: "x", color: "#fff", createdAt: "" }], { sync: false })
    await flushAll()
    expect(isDirty(resource("notes"))).toBe(false)
  })
})

describe("post-its e anexos", () => {
  it("envia o anexo depois de criar o post-it e troca pelo anexo do servidor", async () => {
    state.handler = (path, method) => {
      if (method === "POST" && path.endsWith("/attachments")) {
        return { id: "srv-att-1", name: "a.txt", mimeType: "text/plain", size: 2, url: "https://files/a.txt" }
      }
      return {}
    }
    const dataUrl = "data:text/plain;base64,aGk="
    store.set(
      "postits-v1",
      [
        {
          id: "post-aaaaaaaa",
          title: "T",
          color: "#fef9c3",
          x: 1,
          y: 2,
          completed: false,
          deleted: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          attachments: [{ id: "loc1", name: "a.txt", mimeType: "text/plain", size: 2, data: dataUrl }],
        },
      ],
      { sync: false },
    )
    await flushAll()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /post-its",
      "POST /post-its/post-aaaaaaaa/attachments",
    ])
    const saved = store.get<any[]>("postits-v1", [])
    expect(saved[0].attachments).toEqual([
      { id: "srv-att-1", name: "a.txt", mimeType: "text/plain", size: 2, url: "https://files/a.txt" },
    ])
    expect(isDirty(resource("postits"))).toBe(false)
  })

  it("marca o anexo recusado em vez de repetir o upload", async () => {
    state.handler = (path, method) => {
      if (method === "POST" && path.endsWith("/attachments"))
        throw new FakeApiError(415, "tipo", "UNSUPPORTED_FILE_TYPE")
      return {}
    }
    store.set(
      "postits-v1",
      [
        {
          id: "post-bbbbbbbb",
          title: "T",
          color: "#fff",
          x: 0,
          y: 0,
          completed: false,
          deleted: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          attachments: [{ id: "loc2", name: "x.bin", mimeType: "application/zip", size: 2, data: "data:application/zip;base64,aGk=" }],
        },
      ],
      { sync: false },
    )
    await flushAll()
    const saved = store.get<any[]>("postits-v1", [])
    expect(saved[0].attachments[0].syncError).toBe("Tipo de arquivo não permitido")
    expect(isDirty(resource("postits"))).toBe(false)
  })
})

describe("rotina", () => {
  it("converte registro por dia em tarefas com weekday e posição", async () => {
    store.set(
      "routine-v1",
      { seg: [{ id: "task-aaaaaaaa", name: "Estudar", time: "08:00" }, { id: "task-bbbbbbbb", name: "Ler", time: "" }] },
      { sync: false },
    )
    await flushAll()
    expect(calls[0]).toMatchObject({ path: "/routine-tasks", body: { id: "task-aaaaaaaa", weekday: 1, position: 0, time: "08:00" } })
    expect(calls[1].body).toMatchObject({ id: "task-bbbbbbbb", position: 1, time: null })
  })
})

describe("hidratação", () => {
  it("baixa o snapshot e deixa tudo sincronizado", async () => {
    state.handler = (path) =>
      path === "/sync/snapshot"
        ? {
            workspaces: [{ id: "ws-aaaaaaaa", name: "Faculdade", color: "#3b82f6", icon: "study", description: null, position: 0 }],
            collaborationSpaces: [{ id: "col-aaaaaaaa", name: "TCC", color: "#000", createdAt: "2026-01-01", members: [{ name: "Ana", email: "a@x" }] }],
            postIts: [{ id: "post-cccccccc", title: "P", description: null, dueDate: "2026-10-20T00:00:00.000Z", dueTime: null, color: "#fff", positionX: 5, positionY: 6, completed: false, completedAt: null, deletedAt: null, createdAt: "2026-01-02T00:00:00.000Z", attachments: [] }],
            notes: [
              { id: "note-old", title: null, content: "a", color: "#fff", createdAt: "2026-01-01T00:00:00.000Z" },
              { id: "note-new", title: null, content: "b", color: "#fff", createdAt: "2026-02-01T00:00:00.000Z" },
            ],
            quickLinks: [],
            documents: [],
            spreadsheets: [{ id: "sheet-aaaa", title: "S", cells: {}, columnWidths: { "0": 90 }, createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
            routineTasks: [{ id: "task-aaaaaaaa", weekday: 1, name: "Estudar", time: null, position: 0 }],
            quizzes: [],
            quizAttempts: [],
            whiteboard: { background: "grid", strokes: [{ id: "s1" }] },
            pomodoroSettings: { preset: "focus", studyMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20, sessionsPerCycle: 3 },
            preferences: { darkMode: true, pageZoom: 1.2 },
          }
        : {}

    await hydrate()

    expect(store.get<any[]>("workspaces-v1", [])[0]).toMatchObject({ id: "ws-aaaaaaaa", name: "Faculdade" })
    expect(store.get<any[]>("collab-v1", [])[0].members).toEqual(["Ana"])
    expect(store.get<any[]>("postits-v1", [])[0]).toMatchObject({ x: 5, y: 6, dueDate: "2026-10-20", deleted: false })
    expect(store.get<any[]>("notes-v1", []).map((n) => n.id)).toEqual(["note-new", "note-old"])
    expect(store.get<any[]>("sheets-v1", [])[0].colWidths).toEqual({ "0": 90 })
    expect(store.get<any>("routine-v1", {}).seg).toEqual([{ id: "task-aaaaaaaa", name: "Estudar", time: "" }])
    expect(store.get("wb-bg-v1", "")).toBe("grid")
    expect(store.get<any>("study-session-settings-v1", {}).custom.study).toBe(50)
    expect(store.get("darkmode-v1", false)).toBe(true)
    expect(store.get("zoom-v1", 1)).toBe(1.2)

    for (const r of RESOURCES) expect(isDirty(r), r.name).toBe(false)
  })

  it("preserva alterações locais pendentes ao hidratar", async () => {
    state.handler = (path, method) => {
      if (method === "POST") throw new TypeError("offline")
      return path === "/sync/snapshot" ? { notes: [] } : {}
    }
    store.set("notes-v1", [{ id: "note-eeeeeeee", content: "local", color: "#fff", createdAt: "" }], { sync: false })
    await hydrate()
    expect(store.get<any[]>("notes-v1", []).map((n) => n.id)).toEqual(["note-eeeeeeee"])
  })
})
