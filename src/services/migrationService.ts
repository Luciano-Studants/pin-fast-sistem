import { apiRequest } from "../lib/apiClient"
import type {
  CollabSpace,
  Note,
  PostIt,
  PostItAttachment,
  QuickLink,
  Quiz,
  QuizAttempt,
  Spreadsheet,
  TextDocument,
  Workspace,
} from "../types"

const MIGRATION_MARKER = "pinfast-api-migration-v1"
const DATA_KEYS = [
  "workspaces-v1",
  "collab-v1",
  "postits-v1",
  "notes-v1",
  "links-v1",
  "documents-v1",
  "sheets-v1",
  "routine-v1",
  "quizzes-v1",
  "quiz-attempts-v1",
  "wb-bg-v1",
  "wb-strokes-v1",
  "study-session-settings-v1",
  "darkmode-v1",
  "zoom-v1",
] as const

export interface MigrationRecord {
  id: string
  status: "STARTED" | "DATA_IMPORTED" | "COMPLETED" | "FAILED"
  expectedAttachments: number
  uploadedAttachments: number
  summary?: Record<string, number>
  errorMessage?: string | null
  completedAt?: string | null
}

export interface MigrationProgress {
  phase: "backup" | "data" | "attachments" | "finalizing" | "completed"
  label: string
  current: number
  total: number
}

interface LocalAttachment extends PostItAttachment {
  postItId: string
}

interface MigrationSnapshot {
  workspaces: Workspace[]
  collabSpaces: CollabSpace[]
  postIts: Array<Omit<PostIt, "attachments"> & {
    attachments: Array<Omit<PostItAttachment, "data">>
  }>
  notes: Note[]
  links: QuickLink[]
  documents: TextDocument[]
  sheets: Spreadsheet[]
  routine: Record<string, Array<{ id: string; name: string; time: string }>>
  quizzes: Quiz[]
  quizAttempts: QuizAttempt[]
  whiteboard?: { background: string; strokes: unknown[] }
  pomodoro?: {
    preset: "classic" | "focus" | "deep" | "custom"
    custom: {
      study: number
      shortBreak: number
      longBreak: number
      sessions: number
    }
  }
  preferences: { darkMode: boolean; pageZoom: number }
}

function readLocal<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key)
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    // Chaves antigas (ex.: wb-bg-v1) guardavam texto puro, não JSON
    return value as unknown as T
  }
}

/** Remove os dados antigos (sem escopo de usuário) depois de migrados e sincronizados. */
export function purgeLegacyData() {
  try {
    DATA_KEYS.forEach((key) => localStorage.removeItem(key))
  } catch {
    // ignore
  }
}

export function hasLocalData() {
  return DATA_KEYS.some((key) => {
    const value = localStorage.getItem(key)
    if (!value) return false
    if (value === "[]" || value === "{}" || value === "null") return false
    return true
  })
}

export function getMigrationMarker() {
  return readLocal<{
    userId: string
    version: number
    completedAt: string
  } | null>(MIGRATION_MARKER, null)
}

export function collectMigrationData(): {
  snapshot: MigrationSnapshot
  attachments: LocalAttachment[]
  backup: Record<string, unknown>
} {
  const postIts = readLocal<PostIt[]>("postits-v1", [])
  const attachments: LocalAttachment[] = []
  const sanitizedPostIts = postIts.map((postIt) => {
    const metadata = (postIt.attachments ?? []).map((attachment) => {
      attachments.push({ ...attachment, postItId: postIt.id })
      const { data: _data, ...rest } = attachment
      return rest
    })
    const { attachments: _attachments, ...rest } = postIt
    return { ...rest, attachments: metadata }
  })

  const background = readLocal<string>("wb-bg-v1", "white")
  const strokes = readLocal<unknown[]>("wb-strokes-v1", [])
  const pomodoro = readLocal<MigrationSnapshot["pomodoro"]>(
    "study-session-settings-v1",
    undefined,
  )

  const backup = Object.fromEntries(
    [...DATA_KEYS, "user-profile-v1"].map((key) => [
      key,
      readLocal<unknown>(key, null),
    ]),
  )

  return {
    snapshot: {
      workspaces: readLocal<Workspace[]>("workspaces-v1", []),
      collabSpaces: readLocal<CollabSpace[]>("collab-v1", []),
      postIts: sanitizedPostIts,
      notes: readLocal<Note[]>("notes-v1", []),
      links: readLocal<QuickLink[]>("links-v1", []),
      documents: readLocal<TextDocument[]>("documents-v1", []),
      sheets: readLocal<Spreadsheet[]>("sheets-v1", []),
      routine: readLocal("routine-v1", {
        seg: [],
        ter: [],
        qua: [],
        qui: [],
        sex: [],
        sab: [],
        dom: [],
      }),
      quizzes: readLocal<Quiz[]>("quizzes-v1", []),
      quizAttempts: readLocal<QuizAttempt[]>("quiz-attempts-v1", []),
      whiteboard: { background, strokes },
      pomodoro,
      preferences: {
        darkMode: readLocal<boolean>("darkmode-v1", false),
        pageZoom: readLocal<number>("zoom-v1", 1),
      },
    },
    attachments,
    backup,
  }
}

export function downloadMigrationBackup(backup: Record<string, unknown>) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          format: "pinfast-local-backup",
          version: 1,
          exportedAt: new Date().toISOString(),
          data: backup,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  )
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `pinfast-backup-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

async function attachmentFile(attachment: LocalAttachment) {
  const response = await fetch(attachment.data ?? "")
  const blob = await response.blob()
  return new File([blob], attachment.name, {
    type: attachment.mimeType || blob.type || "application/octet-stream",
  })
}

export async function migrationStatus() {
  return apiRequest<{ version: number; migration: MigrationRecord | null }>(
    "/migrations/local-storage/status",
  )
}

export async function runMigration(
  userId: string,
  onProgress: (progress: MigrationProgress) => void,
) {
  const { snapshot, attachments, backup } = collectMigrationData()
  onProgress({
    phase: "backup",
    label: "Criando backup local",
    current: 0,
    total: 1,
  })
  downloadMigrationBackup(backup)

  onProgress({
    phase: "data",
    label: "Enviando dados organizados",
    current: 0,
    total: 1,
  })
  const imported = await apiRequest<{
    migration: MigrationRecord
    alreadyCompleted?: boolean
  }>("/migrations/local-storage/import", {
    method: "POST",
    body: snapshot,
  })

  if (imported.alreadyCompleted || imported.migration.status === "COMPLETED") {
    markMigrationComplete(userId)
    onProgress({
      phase: "completed",
      label: "Migração concluída",
      current: 1,
      total: 1,
    })
    return {
      migration: imported.migration,
      failedAttachments: [] as LocalAttachment[],
    }
  }

  const failedAttachments: LocalAttachment[] = []
  for (const [index, attachment] of attachments.entries()) {
    onProgress({
      phase: "attachments",
      label: `Enviando anexo ${index + 1} de ${attachments.length}`,
      current: index,
      total: attachments.length,
    })
    try {
      const form = new FormData()
      form.append("file", await attachmentFile(attachment))
      await apiRequest(
        `/migrations/local-storage/${imported.migration.id}/attachments/${encodeURIComponent(attachment.postItId)}/${encodeURIComponent(attachment.id)}`,
        { method: "POST", body: form },
      )
    } catch {
      failedAttachments.push(attachment)
    }
  }

  if (!failedAttachments.length) {
    onProgress({
      phase: "finalizing",
      label: "Validando a migração",
      current: 0,
      total: 1,
    })
    const migration = await finalizeMigration(imported.migration.id, false)
    markMigrationComplete(userId)
    onProgress({
      phase: "completed",
      label: "Migração concluída",
      current: 1,
      total: 1,
    })
    return { migration, failedAttachments }
  }

  return { migration: imported.migration, failedAttachments }
}

export async function finalizeMigration(
  migrationId: string,
  allowMissingAttachments: boolean,
) {
  return apiRequest<MigrationRecord>(
    `/migrations/local-storage/${migrationId}/finalize`,
    { method: "POST", body: { allowMissingAttachments } },
  )
}

export function markMigrationComplete(userId: string) {
  localStorage.setItem(
    MIGRATION_MARKER,
    JSON.stringify({
      userId,
      version: 1,
      completedAt: new Date().toISOString(),
    }),
  )
  try {
    const profile = JSON.parse(localStorage.getItem("user-profile-v1") || "{}")
    delete profile.password
    localStorage.setItem("user-profile-v1", JSON.stringify(profile))
  } catch {}
}
