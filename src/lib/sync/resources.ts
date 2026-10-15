/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiRequest } from "../apiClient"
import { isRetryable, errorMessage } from "./errors"
import type {
  CollectionResource,
  Resource,
  SingletonResource,
  Snapshot,
  SyncContext,
} from "./types"
import type { PostIt, PostItAttachment, QuizAttempt } from "../../types"


type Body = Record<string, unknown>

const nullIfEmpty = (value: unknown) =>
  value === undefined || value === null || value === "" ? null : value
const orUndefined = <T>(value: T | null | undefined) => (value === null ? undefined : value)
const byDate =
  (field: string, direction: 1 | -1 = 1) =>
  (a: any, b: any) =>
    direction * (new Date(a[field]).getTime() - new Date(b[field]).getTime())
const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : undefined)

/** Campos de `next` que diferem de `previous` (ou todos, sem `previous`). */
export function delta(next: Body, previous?: Body): Body {
  if (!previous) return next
  const out: Body = {}
  for (const key of Object.keys(next)) {
    if (JSON.stringify(next[key]) !== JSON.stringify(previous[key])) out[key] = next[key]
  }
  return out
}

interface SimpleOptions<L extends { id: string }> {
  name: string
  label: string
  key: string
  path: string
  debounceMs?: number
  body(item: L, index: number): Body
  createExtra?(item: L): Body
  toList?(value: any): L[]
  pull(snapshot: Snapshot): Record<string, unknown>
}

function simpleCollection<L extends { id: string }>(
  options: SimpleOptions<L>,
): CollectionResource<L> {
  return {
    kind: "collection",
    name: options.name,
    label: options.label,
    key: options.key,
    empty: [],
    debounceMs: options.debounceMs ?? 800,
    toList: options.toList ?? ((value) => (Array.isArray(value) ? value : [])),
    comparable: (item, index) => options.body(item, index),
    async create(item, index) {
      await apiRequest(options.path, {
        method: "POST",
        body: { id: item.id, ...options.body(item, index), ...options.createExtra?.(item) },
      })
    },
    async update(item, previous, index) {
      const patch = delta(
        options.body(item, index),
        previous ? options.body(previous, index) : undefined,
      )
      if (!Object.keys(patch).length) return
      await apiRequest(`${options.path}/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: patch,
      })
    },
    async remove(item) {
      await apiRequest(`${options.path}/${encodeURIComponent(item.id)}`, { method: "DELETE" })
    },
    pull: options.pull,
  }
}

// ── Áreas de trabalho ────────────────────────────────────────────────────────
const workspaces = simpleCollection<any>({
  name: "workspaces",
  label: "áreas de trabalho",
  key: "workspaces-v1",
  path: "/workspaces",
  body: (w, index) => ({
    name: w.name,
    color: w.color,
    icon: w.icon,
    description: nullIfEmpty(w.description),
    position: index,
  }),
  pull: (s) => ({
    "workspaces-v1": [...(s.workspaces ?? [])]
      .sort((a: any, b: any) => a.position - b.position)
      .map((w: any) => ({
        id: w.id,
        name: w.name,
        color: w.color,
        icon: w.icon,
        description: orUndefined(w.description),
      })),
  }),
})

// ── Espaços colaborativos (membros = lista de nomes) ─────────────────────────
const collabBase = simpleCollection<any>({
  name: "collab",
  label: "espaços colaborativos",
  key: "collab-v1",
  path: "/collaboration-spaces",
  body: (c) => ({ name: c.name, color: c.color }),
  pull: (s) => ({
    "collab-v1": [...(s.collaborationSpaces ?? [])]
      .sort(byDate("createdAt"))
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        members: (c.members ?? []).map((m: any) => m.name || m.email),
      })),
  }),
})

const putMembers = (id: string, members: string[]) =>
  apiRequest(`/collaboration-spaces/${encodeURIComponent(id)}/member-names`, {
    method: "PUT",
    body: { names: members },
  })

const collab: CollectionResource<any> = {
  ...collabBase,
  comparable: (c) => ({ name: c.name, color: c.color, members: c.members ?? [] }),
  async create(c, index, ctx) {
    await collabBase.create(c, index, ctx)
    await putMembers(c.id, c.members ?? [])
  },
  async update(c, previous, index, ctx) {
    await collabBase.update(c, previous, index, ctx)
    if (!previous || JSON.stringify(previous.members ?? []) !== JSON.stringify(c.members ?? [])) {
      await putMembers(c.id, c.members ?? [])
    }
  },
}

// ── Post-its (com anexos) ────────────────────────────────────────────────────
const postItBody = (p: PostIt): Body => ({
  title: p.title,
  description: nullIfEmpty(p.description),
  dueDate: nullIfEmpty(p.dueDate),
  dueTime: nullIfEmpty(p.dueTime),
  color: p.color,
  x: Number.isFinite(p.x) ? p.x : 0,
  y: Number.isFinite(p.y) ? p.y : 0,
  completed: p.completed,
  deleted: Boolean(p.deleted),
})

async function attachmentFile(attachment: PostItAttachment) {
  const response = await fetch(attachment.data as string)
  const blob = await response.blob()
  return new File([blob], attachment.name, {
    type: attachment.mimeType || blob.type || "application/octet-stream",
  })
}

const USER_FACING_UPLOAD_ERRORS: Record<string, string> = {
  UNSUPPORTED_FILE_TYPE: "Tipo de arquivo não permitido",
  CONTENT_MISMATCH: "O conteúdo não corresponde ao tipo do arquivo",
  STORAGE_QUOTA_EXCEEDED: "Cota de armazenamento excedida",
  STORAGE_NOT_CONFIGURED: "Armazenamento de arquivos indisponível",
}

async function syncAttachments(
  item: PostIt,
  previous: PostIt | undefined,
  ctx: SyncContext,
): Promise<PostIt> {
  let current = item
  const keepIds = new Set((item.attachments ?? []).map((a) => a.id))

  for (const old of previous?.attachments ?? []) {
    if (!old.url || keepIds.has(old.id)) continue
    try {
      await apiRequest(
        `/post-its/${encodeURIComponent(item.id)}/attachments/${encodeURIComponent(old.id)}`,
        { method: "DELETE" },
      )
    } catch (error) {
      if (isRetryable(error)) throw error
    }
  }

  for (const attachment of item.attachments ?? []) {
    if (attachment.url || attachment.syncError || !attachment.data) continue
    try {
      const form = new FormData()
      form.append("file", await attachmentFile(attachment))
      const uploaded = await apiRequest<any>(`/post-its/${encodeURIComponent(item.id)}/attachments`, {
        method: "POST",
        body: form,
      })
      const replaced = ctx.patchItem<PostIt>("postits-v1", item.id, (p) => ({
        ...p,
        attachments: (p.attachments ?? []).map((a) =>
          a.id === attachment.id
            ? {
                id: uploaded.id,
                name: uploaded.name,
                mimeType: uploaded.mimeType,
                size: uploaded.size,
                url: uploaded.url,
              }
            : a,
        ),
      }))
      if (replaced) current = replaced
    } catch (error) {
      if (isRetryable(error)) throw error
      const code = (error as { code?: string }).code
      const reason = (code && USER_FACING_UPLOAD_ERRORS[code]) || errorMessage(error)
      const marked = ctx.patchItem<PostIt>("postits-v1", item.id, (p) => ({
        ...p,
        attachments: (p.attachments ?? []).map((a) =>
          a.id === attachment.id ? { ...a, syncError: reason } : a,
        ),
      }))
      if (marked) current = marked
    }
  }
  return current
}

const postIts: CollectionResource<PostIt> = {
  kind: "collection",
  name: "postits",
  label: "post-its",
  key: "postits-v1",
  empty: [],
  debounceMs: 800,
  toList: (value) => (Array.isArray(value) ? value : []),
  comparable: (p) => ({
    ...postItBody(p),
    attachments: (p.attachments ?? []).map((a) => [
      a.id,
      a.url ?? (a.syncError ? "error" : "pending"),
    ]),
  }),
  async create(item, _index, ctx) {
    const { deleted, ...body } = postItBody(item)
    await apiRequest("/post-its", {
      method: "POST",
      body: { id: item.id, ...body, createdAt: iso(item.createdAt) },
    })
    if (deleted) {
      await apiRequest(`/post-its/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: { deleted: true },
      })
    }
    return syncAttachments(item, undefined, ctx)
  },
  async update(item, previous, _index, ctx) {
    const patch = delta(postItBody(item), previous ? postItBody(previous) : undefined)
    if (Object.keys(patch).length) {
      await apiRequest(`/post-its/${encodeURIComponent(item.id)}`, { method: "PATCH", body: patch })
    }
    return syncAttachments(item, previous, ctx)
  },
  async remove(item) {
    await apiRequest(`/post-its/${encodeURIComponent(item.id)}`, { method: "DELETE" })
  },
  toShadow: (item) => ({
    ...item,
    attachments: item.attachments?.map(({ data: _data, ...rest }) => rest),
  }),
  pull: (s) => ({
    "postits-v1": [...(s.postIts ?? [])].sort(byDate("createdAt")).map((p: any) => ({
      id: p.id,
      title: p.title,
      description: orUndefined(p.description),
      dueDate: p.dueDate ? String(p.dueDate).slice(0, 10) : undefined,
      dueTime: orUndefined(p.dueTime),
      color: p.color,
      x: p.positionX,
      y: p.positionY,
      completed: p.completed,
      completedAt: p.completedAt ?? undefined,
      deleted: Boolean(p.deletedAt),
      createdAt: p.createdAt,
      attachments: p.attachments?.length
        ? p.attachments.map((a: any) => ({
            id: a.id,
            name: a.name,
            mimeType: a.mimeType,
            size: a.size,
            url: a.url,
          }))
        : undefined,
    })),
  }),
}

// ── Notas, links, documentos e planilhas ─────────────────────────────────────
const notes = simpleCollection<any>({
  name: "notes",
  label: "notas",
  key: "notes-v1",
  path: "/notes",
  body: (n) => ({ title: nullIfEmpty(n.title), content: n.content ?? "", color: n.color }),
  createExtra: (n) => ({ createdAt: iso(n.createdAt) }),
  pull: (s) => ({
    "notes-v1": [...(s.notes ?? [])].sort(byDate("createdAt", -1)).map((n: any) => ({
      id: n.id,
      title: orUndefined(n.title),
      content: n.content,
      color: n.color,
      createdAt: n.createdAt,
    })),
  }),
})

const links = simpleCollection<any>({
  name: "links",
  label: "links rápidos",
  key: "links-v1",
  path: "/quick-links",
  body: (l, index) => ({
    name: l.name,
    url: l.url,
    icon: nullIfEmpty(l.icon),
    color: nullIfEmpty(l.color),
    position: index,
  }),
  pull: (s) => ({
    "links-v1": [...(s.quickLinks ?? [])]
      .sort((a: any, b: any) => a.position - b.position)
      .map((l: any) => ({
        id: l.id,
        name: l.name,
        url: l.url,
        icon: orUndefined(l.icon),
        color: orUndefined(l.color),
      })),
  }),
})

const documents = simpleCollection<any>({
  name: "documents",
  label: "documentos",
  key: "documents-v1",
  path: "/documents",
  debounceMs: 1500,
  body: (d) => ({ title: d.title || "Sem título", content: d.content ?? "" }),
  createExtra: (d) => ({ createdAt: iso(d.createdAt) }),
  pull: (s) => ({
    "documents-v1": [...(s.documents ?? [])].sort(byDate("createdAt")).map((d: any) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
  }),
})

const sheets = simpleCollection<any>({
  name: "sheets",
  label: "planilhas",
  key: "sheets-v1",
  path: "/spreadsheets",
  debounceMs: 1500,
  body: (sheet) => ({
    title: sheet.title || "Sem título",
    cells: sheet.cells ?? {},
    colWidths: sheet.colWidths ?? {},
  }),
  createExtra: (sheet) => ({ createdAt: iso(sheet.createdAt) }),
  pull: (s) => ({
    "sheets-v1": [...(s.spreadsheets ?? [])].sort(byDate("createdAt")).map((sheet: any) => ({
      id: sheet.id,
      title: sheet.title,
      cells: sheet.cells,
      colWidths: sheet.columnWidths,
      createdAt: sheet.createdAt,
      updatedAt: sheet.updatedAt,
    })),
  }),
})

// ── Rotina fixa (registro por dia da semana ↔ lista de tarefas) ──────────────
const DAYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const
const WEEKDAY: Record<(typeof DAYS)[number], number> = {
  dom: 0,
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
  sab: 6,
}
const DAY_BY_WEEKDAY = Object.fromEntries(
  Object.entries(WEEKDAY).map(([day, weekday]) => [weekday, day]),
) as Record<number, (typeof DAYS)[number]>

interface RoutineItem {
  id: string
  day: (typeof DAYS)[number]
  name: string
  time: string
  position: number
}

const routineBody = (t: RoutineItem): Body => ({
  weekday: WEEKDAY[t.day],
  name: t.name,
  time: nullIfEmpty(t.time),
  position: t.position,
})

const routine: CollectionResource<RoutineItem> = {
  kind: "collection",
  name: "routine",
  label: "rotina",
  key: "routine-v1",
  empty: {},
  debounceMs: 800,
  toList: (value) =>
    DAYS.flatMap((day) =>
      (Array.isArray(value?.[day]) ? value[day] : []).map((t: any, position: number) => ({
        id: t.id,
        day,
        name: t.name,
        time: t.time ?? "",
        position,
      })),
    ),
  comparable: (t) => routineBody(t),
  async create(t) {
    await apiRequest("/routine-tasks", { method: "POST", body: { id: t.id, ...routineBody(t) } })
  },
  async update(t, previous) {
    const patch = delta(routineBody(t), previous ? routineBody(previous) : undefined)
    if (!Object.keys(patch).length) return
    await apiRequest(`/routine-tasks/${encodeURIComponent(t.id)}`, { method: "PATCH", body: patch })
  },
  async remove(t) {
    await apiRequest(`/routine-tasks/${encodeURIComponent(t.id)}`, { method: "DELETE" })
  },
  pull: (s) => {
    const record: Record<string, any[]> = { seg: [], ter: [], qua: [], qui: [], sex: [], sab: [], dom: [] }
    const tasks = [...(s.routineTasks ?? [])].sort((a: any, b: any) => a.position - b.position)
    for (const task of tasks) {
      const day = DAY_BY_WEEKDAY[task.weekday]
      if (day) record[day].push({ id: task.id, name: task.name, time: task.time ?? "" })
    }
    return { "routine-v1": record }
  },
}

// ── Questionários e tentativas ───────────────────────────────────────────────
const quizzes = simpleCollection<any>({
  name: "quizzes",
  label: "questionários",
  key: "quizzes-v1",
  path: "/quizzes",
  debounceMs: 1200,
  body: (q) => ({
    title: q.title,
    questions: q.questions ?? [],
    timeLimitMinutes: q.timeLimitMinutes ?? null,
  }),
  createExtra: (q) => ({ createdAt: iso(q.createdAt) }),
  pull: (s) => ({
    "quizzes-v1": [...(s.quizzes ?? [])].sort(byDate("createdAt")).map((q: any) => ({
      id: q.id,
      title: q.title,
      questions: q.questions,
      timeLimitMinutes: q.timeLimitMinutes ?? null,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    })),
  }),
})

// Tentativas são imutáveis: só criação. Remoção acontece em cascata ao excluir o questionário.
const attempts: CollectionResource<QuizAttempt> = {
  kind: "collection",
  name: "attempts",
  label: "tentativas de questionário",
  key: "quiz-attempts-v1",
  empty: [],
  debounceMs: 800,
  toList: (value) => (Array.isArray(value) ? value : []),
  comparable: (a) => ({ id: a.id }),
  async create(a) {
    await apiRequest(`/quizzes/${encodeURIComponent(a.quizId)}/attempts`, {
      method: "POST",
      body: {
        id: a.id,
        answers: a.answers ?? [],
        startedAt: iso(a.startedAt),
        finishedAt: iso(a.finishedAt),
        score: a.score,
        total: a.total,
      },
    })
  },
  async update() {},
  async remove() {},
  pull: (s) => ({
    "quiz-attempts-v1": [...(s.quizAttempts ?? [])].sort(byDate("startedAt")).map((a: any) => ({
      id: a.id,
      quizId: a.quizId,
      answers: a.answers,
      startedAt: a.startedAt,
      finishedAt: a.finishedAt ?? undefined,
      score: a.score ?? undefined,
      total: a.total ?? undefined,
    })),
  }),
}

// ── Valores únicos: quadro branco, pomodoro e preferências ───────────────────
const whiteboard: SingletonResource = {
  kind: "singleton",
  name: "whiteboard",
  label: "quadro branco",
  keys: ["wb-bg-v1", "wb-strokes-v1"],
  defaults: { "wb-bg-v1": "white", "wb-strokes-v1": [] },
  debounceMs: 2000,
  async push(values) {
    await apiRequest("/whiteboard", {
      method: "PUT",
      body: { background: values["wb-bg-v1"], strokes: values["wb-strokes-v1"] },
    })
  },
  pull: (s) =>
    s.whiteboard
      ? { "wb-bg-v1": s.whiteboard.background, "wb-strokes-v1": s.whiteboard.strokes ?? [] }
      : {},
}

const DEFAULT_POMODORO = {
  preset: "classic",
  custom: { study: 25, shortBreak: 5, longBreak: 15, sessions: 4 },
}

const pomodoro: SingletonResource = {
  kind: "singleton",
  name: "pomodoro",
  label: "pomodoro",
  keys: ["study-session-settings-v1"],
  defaults: { "study-session-settings-v1": DEFAULT_POMODORO },
  debounceMs: 1000,
  async push(values) {
    const settings: any = values["study-session-settings-v1"] ?? DEFAULT_POMODORO
    const custom = { ...DEFAULT_POMODORO.custom, ...settings.custom }
    await apiRequest("/pomodoro/settings", {
      method: "PUT",
      body: {
        preset: settings.preset ?? "classic",
        studyMinutes: custom.study,
        shortBreakMinutes: custom.shortBreak,
        longBreakMinutes: custom.longBreak,
        sessionsPerCycle: custom.sessions,
      },
    })
  },
  pull: (s) =>
    s.pomodoroSettings
      ? {
          "study-session-settings-v1": {
            preset: s.pomodoroSettings.preset,
            custom: {
              study: s.pomodoroSettings.studyMinutes,
              shortBreak: s.pomodoroSettings.shortBreakMinutes,
              longBreak: s.pomodoroSettings.longBreakMinutes,
              sessions: s.pomodoroSettings.sessionsPerCycle,
            },
          },
        }
      : {},
}

const preferences: SingletonResource = {
  kind: "singleton",
  name: "preferences",
  label: "preferências",
  keys: ["darkmode-v1", "zoom-v1"],
  defaults: { "darkmode-v1": false, "zoom-v1": 1 },
  debounceMs: 1000,
  async push(values) {
    await apiRequest("/preferences", {
      method: "PUT",
      body: { darkMode: Boolean(values["darkmode-v1"]), pageZoom: values["zoom-v1"] },
    })
  },
  pull: (s) =>
    s.preferences
      ? { "darkmode-v1": s.preferences.darkMode, "zoom-v1": s.preferences.pageZoom }
      : {},
}

/** Ordem importa: questionários antes das tentativas, post-its antes dos anexos etc. */
export const RESOURCES: Resource[] = [
  workspaces,
  collab,
  postIts,
  notes,
  links,
  documents,
  sheets,
  routine,
  quizzes,
  attempts,
  whiteboard,
  pomodoro,
  preferences,
]

export function resourceForKey(key: string): Resource | undefined {
  return RESOURCES.find((r) => (r.kind === "collection" ? r.key === key : r.keys.includes(key)))
}
