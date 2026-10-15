import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { useAuth } from "../../contexts/AuthContext"
import * as store from "../../lib/store/store"
import { hydrate, startSync, stopSync } from "../../lib/sync/engine"
import { getMigrationMarker, purgeLegacyData } from "../../services/migrationService"
import SplashScreen from "../SplashScreen"

type GateState = "loading" | "ready" | "error"

/**
 * Ativa o cache por usuário e sincroniza com a API antes de mostrar o aplicativo.
 * Sem rede, abre com o que já está salvo neste dispositivo (se houver).
 */
export default function SyncGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<GateState>("loading")
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!user) return
    let active = true
    store.setScope(user.id)
    startSync()
    setState("loading")

    const run = async () => {
      try {
        await hydrate()
        if (getMigrationMarker()?.userId === user.id) purgeLegacyData()
        if (active) setState("ready")
      } catch (cause) {
        if (!active) return
        if (store.has("workspaces-v1")) {
          // Já houve sincronização neste dispositivo: segue offline, reenviando depois.
          setState("ready")
          return
        }
        setMessage(
          cause instanceof Error ? cause.message : "Não foi possível carregar seus dados.",
        )
        setState("error")
      }
    }
    void run()

    return () => {
      active = false
      stopSync()
    }
  }, [user, attempt])

  if (state === "ready") return <>{children}</>
  if (state === "loading") return <SplashScreen label="Sincronizando seus dados…" />

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: 14,
        fontFamily: "Outfit, sans-serif",
        background: "#f5ede0",
        color: "#2d1a0a",
        padding: 24,
        textAlign: "center",
      }}
    >
      <p style={{ fontWeight: 700, fontSize: 16 }}>Não foi possível carregar seus dados</p>
      <p style={{ fontSize: 13, opacity: 0.75, maxWidth: 360 }}>{message}</p>
      <button
        onClick={() => setAttempt((n) => n + 1)}
        style={{
          background: "#e07b39",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "8px 24px",
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        Tentar novamente
      </button>
    </div>
  )
}
