import { clearSyncError } from "../../lib/sync/engine"
import { useSyncStatus } from "../../lib/sync/useSyncStatus"

/** Pílula discreta com o estado da sincronização. Some quando está tudo salvo. */
export default function SyncIndicator() {
  const status = useSyncStatus()

  let text: string | null = null
  let color = "#8b6d50"
  if (status.error) {
    text = status.error
    color = "#d95c4f"
  } else if (status.offline && status.pending > 0) {
    text = "Sem conexão — alterações salvas neste dispositivo"
    color = "#b7791f"
  } else if (status.syncing || status.pending > 0) {
    text = "Salvando…"
  }
  if (!text) return null

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={status.error ? clearSyncError : undefined}
      title={status.error ? "Clique para dispensar" : undefined}
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 60,
        maxWidth: 360,
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "Outfit, sans-serif",
        background: "rgba(255,253,249,0.95)",
        color,
        border: `1px solid ${color}55`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        cursor: status.error ? "pointer" : "default",
      }}
    >
      {text}
    </div>
  )
}
