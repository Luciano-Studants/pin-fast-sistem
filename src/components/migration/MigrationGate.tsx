import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useAuth } from "../../contexts/AuthContext"
import {
  collectMigrationData,
  downloadMigrationBackup,
  finalizeMigration,
  getMigrationMarker,
  hasLocalData,
  markMigrationComplete,
  migrationStatus,
  runMigration,
  type MigrationProgress,
} from "../../services/migrationService"
import SplashScreen from "../SplashScreen"

type GateState = "checking" | "ready" | "migrating" | "attachments-failed" | "error" | "completed"

export default function MigrationGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<GateState>("checking")
  const [progress, setProgress] = useState<MigrationProgress | null>(null)
  const [error, setError] = useState("")
  const [migrationId, setMigrationId] = useState("")
  const [failedCount, setFailedCount] = useState(0)

  const localSummary = useMemo(() => {
    const { snapshot, attachments } = collectMigrationData()
    return {
      workspaces: snapshot.workspaces.length,
      postIts: snapshot.postIts.length,
      notes: snapshot.notes.length,
      documents: snapshot.documents.length + snapshot.sheets.length,
      quizzes: snapshot.quizzes.length,
      attachments: attachments.length,
    }
  }, [])

  useEffect(() => {
    let active = true
    const check = async () => {
      if (!user) return
      const marker = getMigrationMarker()
      if (marker?.userId === user.id && marker.version === 1) {
        if (active) setState("completed")
        return
      }
      if (!hasLocalData()) {
        if (active) setState("completed")
        return
      }
      try {
        const response = await migrationStatus()
        if (!active) return
        if (response.migration?.status === "COMPLETED") {
          markMigrationComplete(user.id)
          setState("completed")
        } else {
          setState("ready")
        }
      } catch (cause) {
        if (!active) return
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível verificar a migração.",
        )
        setState("error")
      }
    }
    void check()
    return () => {
      active = false
    }
  }, [user])

  const migrate = async () => {
    if (!user) return
    setState("migrating")
    setError("")
    try {
      const result = await runMigration(user.id, setProgress)
      if (result.failedAttachments.length) {
        setMigrationId(result.migration.id)
        setFailedCount(result.failedAttachments.length)
        setState("attachments-failed")
      } else {
        setState("completed")
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "A migração não pôde ser concluída.",
      )
      setState("error")
    }
  }

  const finishWithoutAttachments = async () => {
    if (!user || !migrationId) return
    setState("migrating")
    setProgress({
      phase: "finalizing",
      label: "Finalizando sem os anexos pendentes",
      current: 0,
      total: 1,
    })
    try {
      await finalizeMigration(migrationId, true)
      markMigrationComplete(user.id)
      setState("completed")
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível finalizar a migração.",
      )
      setState("error")
    }
  }

  if (state === "completed") return <>{children}</>
  if (state === "checking")
    return <SplashScreen label="Verificando seus dados…" />

  const totalItems = Object.values(localSummary).reduce(
    (total, value) => total + value,
    0,
  )
  const percent = progress
    ? progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 20
    : 0

  return (
    <div
      className="size-full overflow-y-auto bg-[#f5ede0] px-4 py-6 sm:px-6 sm:py-10"
      style={{ fontFamily: "Outfit, sans-serif" }}
    >
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-[#e8d5b7] bg-[#fffdf9] p-5 shadow-xl sm:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0e4] text-[#e07b39]">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 20h14" />
          </svg>
        </div>

        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e07b39]">
          Migração segura
        </p>
        <h1
          className="mt-1 text-2xl font-black text-[#2d1a0a]"
          style={{ fontFamily: "Nunito, sans-serif" }}
        >
          Leve seus dados para sua conta
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#7a5c3c]">
          Encontramos dados salvos neste dispositivo. Antes de entrar, faremos
          um backup e enviaremos tudo de forma idempotente para que uma
          tentativa repetida não crie duplicações.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            ["Post-its", localSummary.postIts],
            ["Áreas", localSummary.workspaces],
            ["Anotações", localSummary.notes],
            ["Arquivos", localSummary.documents],
            ["Questionários", localSummary.quizzes],
            ["Anexos", localSummary.attachments],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-[#f7efe4] px-3 py-3">
              <p
                className="text-lg font-black text-[#2d1a0a]"
                style={{ fontFamily: "Nunito, sans-serif" }}
              >
                {value}
              </p>
              <p className="text-xs text-[#8b6d50]">{label}</p>
            </div>
          ))}
        </div>

        {state === "migrating" && progress && (
          <div className="mt-6 rounded-2xl border border-[#ead8be] bg-[#fffaf4] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-[#2d1a0a]">
                {progress.label}
              </p>
              <span className="text-xs font-bold tabular-nums text-[#e07b39]">
                {Math.min(100, percent)}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eadfce]">
              <div
                className="h-full rounded-full bg-[#e07b39] transition-all"
                style={{ width: `${Math.max(8, percent)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[#8b6d50]">
              Não feche esta página durante o envio.
            </p>
          </div>
        )}

        {state === "attachments-failed" && (
          <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-black text-amber-900">
              Alguns anexos não foram enviados
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {failedCount} anexo(s) falharam. Seus demais dados já estão
              seguros no servidor.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-black text-red-800">
              Não foi possível concluir
            </p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {(state === "ready" || state === "error") && (
            <>
              <button
                type="button"
                onClick={() =>
                  downloadMigrationBackup(collectMigrationData().backup)
                }
                className="min-h-12 flex-1 rounded-2xl border border-[#e8d5b7] bg-white px-4 text-sm font-bold text-[#7a5c3c]"
              >
                Baixar backup
              </button>
              <button
                type="button"
                onClick={() => void migrate()}
                className="min-h-12 flex-[1.4] rounded-2xl bg-[#e07b39] px-5 text-sm font-black text-white shadow-lg shadow-orange-200"
              >
                {state === "error"
                  ? "Tentar novamente"
                  : `Migrar ${totalItems} itens`}
              </button>
            </>
          )}
          {state === "attachments-failed" && (
            <>
              <button
                type="button"
                onClick={() => void migrate()}
                className="min-h-12 flex-1 rounded-2xl bg-[#e07b39] px-4 text-sm font-black text-white"
              >
                Tentar anexos novamente
              </button>
              <button
                type="button"
                onClick={() => void finishWithoutAttachments()}
                className="min-h-12 flex-1 rounded-2xl border border-[#e8d5b7] bg-white px-4 text-sm font-bold text-[#7a5c3c]"
              >
                Continuar sem anexos
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
