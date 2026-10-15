import { useState, useRef, useEffect } from "react"
import type { Workspace, CollabSpace } from "../types"
import { useAuth } from "../contexts/AuthContext"
import { newId } from '../lib/id'

const WS_ICONS = [
  "🎓",
  "💼",
  "🚀",
  "🏠",
  "🎨",
  "📚",
  "🏋️",
  "🎮",
  "🧪",
  "💡",
  "🌍",
  "🎯",
]
const WS_COLORS = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
]

interface Props {
  open: boolean
  onToggle: () => void
  workspaces: Workspace[]
  collabSpaces: CollabSpace[]
  activeWorkspace: string
  onSelectWorkspace: (id: string) => void
  onAddWorkspace: (w: Workspace) => void
  onDeleteWorkspace: (id: string) => void
  onAddCollab: (c: CollabSpace) => void
  onLogout: () => void
  onSelectRoutine?: () => void
  routineActive?: boolean
}

export default function Sidebar({
  open,
  onToggle,
  workspaces,
  collabSpaces,
  activeWorkspace,
  onSelectWorkspace,
  onAddWorkspace,
  onDeleteWorkspace,
  onAddCollab,
  onLogout,
  onSelectRoutine,
  routineActive,
}: Props) {
  const { user } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [addingWs, setAddingWs] = useState(false)
  const [addingCollab, setAddingCollab] = useState(false)
  const [wsForm, setWsForm] = useState({
    name: "",
    icon: "📁",
    color: "#3b82f6",
  })
  const [collabForm, setCollabForm] = useState({
    name: "",
    color: "#6366f1",
    members: "",
  })
  const wsInputRef = useRef<HTMLInputElement>(null)
  const collabInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingWs) wsInputRef.current?.focus()
  }, [addingWs])
  useEffect(() => {
    if (addingCollab) collabInputRef.current?.focus()
  }, [addingCollab])

  const filteredWs = workspaces.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()),
  )

  const confirmAddWs = () => {
    if (!wsForm.name.trim()) return
    onAddWorkspace({
      id: newId(),
      name: wsForm.name.trim(),
      icon: wsForm.icon,
      color: wsForm.color,
    })
    setWsForm({ name: "", icon: "📁", color: "#3b82f6" })
    setAddingWs(false)
  }

  const confirmAddCollab = () => {
    if (!collabForm.name.trim()) return
    onAddCollab({
      id: newId(),
      name: collabForm.name.trim(),
      color: collabForm.color,
      members: collabForm.members
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
    })
    setCollabForm({ name: "", color: "#6366f1", members: "" })
    setAddingCollab(false)
  }

  const displayName = user?.name || "Usuário"
  const displayEmail = user?.email || "usuario@email.com"
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  if (!open) {
    return (
      <div
        className="pinfast-sidebar pinfast-sidebar-collapsed hidden md:flex flex-col items-center py-3 gap-1.5 shrink-0"
        style={{
          width: 56,
          background: "#2d1f14",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={onToggle}
          className="w-9 h-9 rounded-xl flex items-center justify-center mb-1 hover:bg-white/10 transition-colors"
        >
          <span
            className="text-xl font-black"
            style={{ fontFamily: "Nunito, sans-serif", color: "#e07b39" }}
          >
            P
          </span>
        </button>
        <div
          className="w-6 h-px mb-1"
          style={{ background: "rgba(255,255,255,0.1)" }}
        />
        {/* Rotina shortcut */}
        <button
          onClick={onSelectRoutine}
          title="Rotina"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
          style={{
            background: routineActive ? "rgba(224,123,57,0.18)" : "transparent",
            borderLeft: routineActive
              ? "3px solid #e07b39"
              : "3px solid transparent",
          }}
        >
          <span style={{ fontSize: 16 }}>🗓️</span>
        </button>
        <div
          className="w-6 h-px my-1"
          style={{ background: "rgba(255,255,255,0.1)" }}
        />
        {workspaces.map((w) => (
          <button
            key={w.id}
            onClick={() => onSelectWorkspace(w.id)}
            title={w.name}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
            style={{
              background:
                activeWorkspace === w.id
                  ? "rgba(224,123,57,0.18)"
                  : "transparent",
              borderLeft:
                activeWorkspace === w.id
                  ? `3px solid ${w.color}`
                  : "3px solid transparent",
            }}
          >
            <span style={{ fontSize: 16 }}>{w.icon}</span>
          </button>
        ))}
        <div className="mt-auto mb-1 relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
            style={{
              background: "#e07b39",
              color: "#fff",
              fontFamily: "Nunito, sans-serif",
            }}
          >
            {initials || "U"}
          </button>
          {profileOpen && (
            <div
              className="absolute bottom-full left-0 mb-2 rounded-xl overflow-hidden z-50 w-44"
              style={{
                background: "#3d2c1e",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
              }}
            >
              <button
                onClick={onLogout}
                className="w-full px-4 py-2.5 text-left text-xs hover:bg-red-900/20 transition-colors"
                style={{ color: "#ef4444", fontFamily: "Outfit, sans-serif" }}
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="pinfast-sidebar fixed md:relative inset-y-0 left-0 z-50 md:z-auto flex flex-col shrink-0 shadow-2xl md:shadow-none"
      style={{
        width: 220,
        background: "#2d1f14",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-4 shrink-0">
        <span
          className="text-xl font-black tracking-tight"
          style={{ fontFamily: "Nunito, sans-serif", color: "#f0e6d3" }}
        >
          PIN<span style={{ color: "#e07b39" }}>FAST</span>
        </span>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M1 1l10 10M11 1L1 11"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3 shrink-0">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar área..."
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: "#f0e6d3", fontFamily: "Outfit, sans-serif" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-4 pb-3">
        {/* Rotina — centralized agenda, first item */}
        <div>
          <p
            className="px-2 mb-1.5 text-xs font-bold uppercase tracking-widest"
            style={{
              color: "rgba(255,255,255,0.28)",
              fontFamily: "Outfit, sans-serif",
              fontSize: 10,
            }}
          >
            Agenda
          </p>
          <button
            onClick={onSelectRoutine}
            className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-xl text-left transition-all"
            style={{
              background: routineActive
                ? "rgba(224,123,57,0.18)"
                : "rgba(255,255,255,0.04)",
              borderLeft: routineActive
                ? "3px solid #e07b39"
                : "3px solid transparent",
            }}
          >
            <span style={{ fontSize: 16 }}>🗓️</span>
            <div className="flex-1 min-w-0">
              <span
                className="text-sm font-semibold block leading-none"
                style={{
                  color: routineActive ? "#e07b39" : "rgba(240,230,211,0.85)",
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                Rotina
              </span>
              <span
                className="text-[9px] mt-0.5 block"
                style={{
                  color: "rgba(255,255,255,0.28)",
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                Agenda centralizada
              </span>
            </div>
            {routineActive && (
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: "#e07b39" }}
              />
            )}
          </button>
        </div>

        {/* Workspaces */}
        <div>
          <p
            className="px-2 mb-1.5 text-xs font-bold uppercase tracking-widest"
            style={{
              color: "rgba(255,255,255,0.28)",
              fontFamily: "Outfit, sans-serif",
              fontSize: 10,
            }}
          >
            Áreas de trabalho
          </p>

          {filteredWs.length === 0 && search && (
            <p
              className="px-2 py-1 text-xs"
              style={{
                color: "rgba(255,255,255,0.25)",
                fontFamily: "Outfit, sans-serif",
              }}
            >
              Nenhuma área encontrada
            </p>
          )}

          {filteredWs.map((w) => (
            <div key={w.id} className="group flex items-center mb-0.5">
              <button
                onClick={() => onSelectWorkspace(w.id)}
                className="flex-1 flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-all"
                style={{
                  background:
                    activeWorkspace === w.id
                      ? "rgba(224,123,57,0.14)"
                      : "transparent",
                  borderLeft:
                    activeWorkspace === w.id
                      ? `3px solid ${w.color}`
                      : "3px solid transparent",
                }}
              >
                <span style={{ fontSize: 15 }}>{w.icon}</span>
                <span
                  className="text-sm flex-1 truncate"
                  style={{
                    color:
                      activeWorkspace === w.id
                        ? "#f0e6d3"
                        : "rgba(240,230,211,0.55)",
                    fontFamily: "Outfit, sans-serif",
                  }}
                >
                  {w.name}
                </span>
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: w.color, opacity: 0.7 }}
                />
              </button>
              {workspaces.length > 1 && (
                <button
                  onClick={() => onDeleteWorkspace(w.id)}
                  title="Remover área"
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 ml-1 p-1 rounded-lg hover:bg-red-900/30 transition-all"
                  style={{ color: "#ef4444" }}
                >
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {/* Add workspace form */}
          {addingWs ? (
            <div
              className="mt-1 px-2 py-2 rounded-xl space-y-2"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <input
                ref={wsInputRef}
                value={wsForm.name}
                onChange={(e) =>
                  setWsForm((f) => ({ ...f, name: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmAddWs()
                  if (e.key === "Escape") setAddingWs(false)
                }}
                placeholder="Nome da área…"
                className="w-full bg-transparent outline-none text-xs px-1"
                style={{
                  color: "#f0e6d3",
                  fontFamily: "Outfit, sans-serif",
                  borderBottom: "1px solid rgba(255,255,255,0.15)",
                }}
              />
              <div className="flex gap-1 flex-wrap">
                {WS_ICONS.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setWsForm((f) => ({ ...f, icon: ic }))}
                    className="text-base rounded-lg p-0.5 transition-all"
                    style={{
                      background:
                        wsForm.icon === ic
                          ? "rgba(224,123,57,0.3)"
                          : "transparent",
                    }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 flex-wrap">
                {WS_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setWsForm((f) => ({ ...f, color: c }))}
                    className="w-4 h-4 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: c,
                      border:
                        wsForm.color === c
                          ? "2px solid #fff"
                          : "1px solid transparent",
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={confirmAddWs}
                  disabled={!wsForm.name.trim()}
                  className="flex-1 text-[10px] font-bold py-1 rounded-lg disabled:opacity-40"
                  style={{ background: "#e07b39", color: "#fff" }}
                >
                  Criar
                </button>
                <button
                  onClick={() => setAddingWs(false)}
                  className="flex-1 text-[10px] font-bold py-1 rounded-lg"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingWs(true)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-all opacity-40 hover:opacity-70 mt-1"
            >
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>
                ＋
              </span>
              <span
                className="text-xs"
                style={{
                  color: "rgba(240,230,211,0.5)",
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                Nova área
              </span>
            </button>
          )}
        </div>

        {/* Collab spaces */}
        <div>
          <p
            className="px-2 mb-1.5 text-xs font-bold uppercase tracking-widest"
            style={{
              color: "rgba(255,255,255,0.28)",
              fontFamily: "Outfit, sans-serif",
              fontSize: 10,
            }}
          >
            Espaços Colab
          </p>
          {collabSpaces.map((s) => (
            <div
              key={s.id}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl mb-0.5"
              style={{ opacity: 0.75 }}
            >
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: s.color }}
              >
                <span style={{ fontSize: 11 }}>👥</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p
                  className="text-xs font-medium truncate"
                  style={{ color: "#f0e6d3", fontFamily: "Outfit, sans-serif" }}
                >
                  {s.name}
                </p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "Outfit, sans-serif",
                    fontSize: 10,
                  }}
                >
                  {s.members.length > 0
                    ? s.members.join(", ")
                    : `${s.members.length} membros`}
                </p>
              </div>
            </div>
          ))}

          {addingCollab ? (
            <div
              className="mt-1 px-2 py-2 rounded-xl space-y-2"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <input
                ref={collabInputRef}
                value={collabForm.name}
                onChange={(e) =>
                  setCollabForm((f) => ({ ...f, name: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Escape") setAddingCollab(false)
                }}
                placeholder="Nome do espaço…"
                className="w-full bg-transparent outline-none text-xs px-1"
                style={{
                  color: "#f0e6d3",
                  fontFamily: "Outfit, sans-serif",
                  borderBottom: "1px solid rgba(255,255,255,0.15)",
                }}
              />
              <input
                value={collabForm.members}
                onChange={(e) =>
                  setCollabForm((f) => ({ ...f, members: e.target.value }))
                }
                placeholder="Membros (separados por vírgula)"
                className="w-full bg-transparent outline-none text-xs px-1"
                style={{
                  color: "#f0e6d3",
                  fontFamily: "Outfit, sans-serif",
                  borderBottom: "1px solid rgba(255,255,255,0.15)",
                }}
              />
              <div className="flex gap-1 flex-wrap">
                {WS_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCollabForm((f) => ({ ...f, color: c }))}
                    className="w-4 h-4 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: c,
                      border:
                        collabForm.color === c
                          ? "2px solid #fff"
                          : "1px solid transparent",
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={confirmAddCollab}
                  disabled={!collabForm.name.trim()}
                  className="flex-1 text-[10px] font-bold py-1 rounded-lg disabled:opacity-40"
                  style={{ background: "#e07b39", color: "#fff" }}
                >
                  Criar
                </button>
                <button
                  onClick={() => setAddingCollab(false)}
                  className="flex-1 text-[10px] font-bold py-1 rounded-lg"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingCollab(true)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-all opacity-40 hover:opacity-70 mt-1"
            >
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>
                ＋
              </span>
              <span
                className="text-xs"
                style={{
                  color: "rgba(240,230,211,0.5)",
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                Novo espaço colab
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Profile */}
      <div
        className="px-3 py-3 shrink-0 relative"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
            style={{
              background: "#e07b39",
              color: "#fff",
              fontFamily: "Nunito, sans-serif",
            }}
          >
            {initials || "U"}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p
              className="text-xs font-semibold truncate"
              style={{ color: "#f0e6d3", fontFamily: "Outfit, sans-serif" }}
            >
              {displayName}
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.35)",
                fontFamily: "Outfit, sans-serif",
                fontSize: 10,
              }}
            >
              {displayEmail}
            </p>
          </div>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
            {profileOpen ? "▼" : "▲"}
          </span>
        </button>

        {profileOpen && (
          <div
            className="absolute bottom-full left-3 right-3 mb-1 rounded-xl overflow-hidden z-50"
            style={{
              background: "#3d2c1e",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="px-4 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-xs font-bold" style={{ color: "#f0e6d3" }}>
                {displayName}
              </p>
              <p
                className="text-[10px]"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {displayEmail}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="w-full px-4 py-2.5 text-left text-xs hover:bg-red-900/20 transition-colors flex items-center gap-2"
              style={{ color: "#ef4444", fontFamily: "Outfit, sans-serif" }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sair da conta
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
