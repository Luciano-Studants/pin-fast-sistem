import React, { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import type { PostIt, Note, QuickLink, Workspace, CollabSpace, TextDocument, Spreadsheet } from '../types'
import type { BoardExportFn } from './Board'
import Sidebar from './Sidebar'
import Board from './Board'
import CreatePostItModal from './modals/CreatePostItModal'
import PostItDetailModal from './modals/PostItDetailModal'
import Toast from './Toast'
import SyncIndicator from './sync/SyncIndicator'
import { useStoredState } from '../lib/store/useStoredState'
import { newId } from '../lib/id'
import SplashScreen from './SplashScreen'

const TextEditor = lazy(() => import('./TextEditor'))
const SpreadsheetEditor = lazy(() => import('./SpreadsheetEditor'))
const RoutineTab = lazy(() => import('./RoutineTab'))
const QuizTab = lazy(() => import('./quiz/QuizTab'))
const WhiteboardTab = lazy(() => import('./WhiteboardTab'))
const StudySessionTab = lazy(() => import('./study/StudySessionTab'))

const SHORTCUTS = [
  { keys: ['Clique'], action: 'Abrir detalhes do post-it' },
  { keys: ['Arrastar'], action: 'Mover post-it pelo quadro' },
  { keys: ['Soltar em Realizadas'], action: 'Concluir tarefa automaticamente' },
  { keys: ['Soltar em Ativas'], action: 'Reabrir tarefa concluída' },
  { keys: ['Soltar na 🗑️'], action: 'Excluir post-it' },
  { keys: ['Esc'], action: 'Fechar modal aberto' },
]

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'warning' | 'error' | 'info'
}

interface Props {
  onLogout: () => void
}

export default function MainApp({ onLogout }: Props) {
  const [workspaces, setWorkspaces] = useStoredState<Workspace[]>('workspaces-v1', [])
  const [collabSpaces, setCollabSpaces] = useStoredState<CollabSpace[]>('collab-v1', [])
  const [selectedWorkspace, setActiveWorkspace] = useState<string | null>(null)
  const [postIts, setPostIts] = useStoredState<PostIt[]>('postits-v1', [])
  const [notes, setNotes] = useStoredState<Note[]>('notes-v1', [])
  const [links, setLinks] = useStoredState<QuickLink[]>('links-v1', [])
  const [compactViewport, setCompactViewport] = useState(() => window.innerWidth < 768)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailPostIt, setDetailPostIt] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<'calendar' | 'notes' | 'links'>('calendar')
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Documents
  const [documents, setDocuments] = useStoredState<TextDocument[]>('documents-v1', [])
  const [activeDocId, setActiveDocId] = useState<string | null>(null)

  // Spreadsheets
  const [sheets, setSheets] = useStoredState<Spreadsheet[]>('sheets-v1', [])
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null)

  // Accessibility state
  const [darkMode, setDarkMode] = useStoredState<boolean>('darkmode-v1', false)
  const [pageZoom, setPageZoom] = useStoredState<number>('zoom-v1', 1)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Export
  const boardExportRef = useRef<BoardExportFn | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = async (fmt: 'png' | 'svg' | 'pdf') => {
    if (!boardExportRef.current) return
    setExportOpen(false)
    setExporting(true)
    await boardExportRef.current(fmt)
    setExporting(false)
  }

  // VLibras initialization
  useEffect(() => {
    if ((window as any).__vlibrasLoaded) return
    ;(window as any).__vlibrasLoaded = true

    const wrapper = document.createElement('div')
    wrapper.setAttribute('vw', '')
    wrapper.className = 'enabled'
    wrapper.innerHTML = `
      <div vw-access-button class="active"></div>
      <div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>
    `
    document.body.appendChild(wrapper)

    const script = document.createElement('script')
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js'
    script.onload = () => {
      try {
        if ((window as any).VLibras) new (window as any).VLibras.Widget('https://vlibras.gov.br/app')
      } catch (e) { console.warn('VLibras failed to initialize', e) }
    }
    script.onerror = () => console.warn('VLibras script failed to load')
    document.head.appendChild(script)
  }, [])

  // Sync dark mode class on <html>
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [darkMode])

  useEffect(() => {
    const onResize = () => {
      const compact = window.innerWidth < 768
      setCompactViewport(compact)
      if (compact) setSidebarOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Close shortcuts on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowShortcuts(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastItem['type'] = 'info') => {
      const id = newId()
      setToasts((t) => [...t, { id, message, type }])
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
    },
    []
  )

  const handleUpdateSheet = useCallback((id: string, title: string, cells: Spreadsheet['cells'], colWidths: Spreadsheet['colWidths']) => {
    setSheets((ss) => ss.map((s) => s.id === id ? { ...s, title, cells, colWidths, updatedAt: new Date().toISOString() } : s))
  }, [])

  const handleDeleteSheet = useCallback((id: string) => {
    setSheets((ss) => ss.filter((s) => s.id !== id))
    setActiveSheetId((cur) => (cur === id ? null : cur))
  }, [])

  const handleUpdateDoc = useCallback((id: string, title: string, content: string) => {
    setDocuments((docs) =>
      docs.map((d) => d.id === id ? { ...d, title, content, updatedAt: new Date().toISOString() } : d)
    )
  }, [])

  const handleDeleteDoc = useCallback((id: string) => {
    setDocuments((docs) => docs.filter((d) => d.id !== id))
    setActiveDocId((cur) => (cur === id ? null : cur))
  }, [])

  // Fixed tabs
  const [showRoutine, setShowRoutine] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const [showStudySession, setShowStudySession] = useState(false)

  const clearFixedTabs = () => { setShowRoutine(false); setShowQuiz(false); setShowWhiteboard(false); setShowStudySession(false) }

  // When selecting a tab, deactivate the other type
  const selectDoc = useCallback((id: string | null) => { setActiveDocId(id); setActiveSheetId(null); clearFixedTabs() }, [])
  const selectSheet = useCallback((id: string | null) => { setActiveSheetId(id); setActiveDocId(null); clearFixedTabs() }, [])
  const selectBoard = useCallback(() => { setActiveDocId(null); setActiveSheetId(null); clearFixedTabs() }, [])
  const selectRoutine = useCallback(() => { setActiveDocId(null); setActiveSheetId(null); setShowRoutine(true); setShowQuiz(false); setShowWhiteboard(false); setShowStudySession(false) }, [])
  const selectQuiz = useCallback(() => { setActiveDocId(null); setActiveSheetId(null); setShowQuiz(true); setShowRoutine(false); setShowWhiteboard(false); setShowStudySession(false) }, [])
  const selectWhiteboard = useCallback(() => { setActiveDocId(null); setActiveSheetId(null); setShowWhiteboard(true); setShowRoutine(false); setShowQuiz(false); setShowStudySession(false) }, [])
  const selectStudySession = useCallback(() => { setActiveDocId(null); setActiveSheetId(null); setShowStudySession(true); setShowRoutine(false); setShowQuiz(false); setShowWhiteboard(false) }, [])

  const handleCreate = (data: Partial<PostIt>) => {
    const half = 340
    const isCompleted = data.completed ?? false
    const newPostIt: PostIt = {
      id: newId(),
      title: data.title || 'Novo post-it',
      description: data.description,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      color: data.color || '#fef9c3',
      x: isCompleted ? half + 40 + Math.random() * 160 : 40 + Math.random() * (half - 100),
      y: 50 + Math.random() * 160,
      completed: false,
      deleted: false,
      createdAt: new Date().toISOString(),
    }
    setPostIts((p) => [...p, newPostIt])
    setCreateOpen(false)
    showToast('Post-it criado!', 'success')
  }

  const handleComplete = (id: string) => {
    const target = postIts.find((p) => p.id === id)
    if (!target) return
    const willComplete = !target.completed
    setPostIts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, completed: willComplete, completedAt: willComplete ? new Date().toISOString() : undefined }
          : p
      )
    )
    if (willComplete) showToast('Tarefa concluída! ✓', 'success')
    else showToast('Tarefa reaberta', 'info')
  }

  const handleDelete = (id: string) => {
    setPostIts((p) => p.map((pi) => (pi.id === id ? { ...pi, deleted: true } : pi)))
    setDetailPostIt((cur) => (cur === id ? null : cur))
    showToast('Post-it removido', 'warning')
  }

  const handleMove = useCallback((id: string, x: number, y: number) => {
    setPostIts((p) => p.map((pi) => (pi.id === id ? { ...pi, x, y } : pi)))
  }, [])

  const visiblePostIts = useMemo(() => postIts.filter((p) => !p.deleted), [postIts])
  const activeWorkspace = workspaces.some((w) => w.id === selectedWorkspace) ? (selectedWorkspace as string) : (workspaces[0]?.id ?? '')
  const activeWs = useMemo(() => workspaces.find((w) => w.id === activeWorkspace), [workspaces, activeWorkspace])
  const detailPost = detailPostIt ? postIts.find((p) => p.id === detailPostIt) ?? null : null

  const clampZoom = (z: number) => Math.min(1.5, Math.max(0.6, z))
  const effectivePageZoom = compactViewport ? 1 : pageZoom

  return (
    <>
    <SyncIndicator />
    <div
      className="size-full flex overflow-hidden"
      style={{
        background: darkMode ? '#0f0d0b' : '#f5ede0',
        fontFamily: 'Outfit, sans-serif',
        transform: `scale(${effectivePageZoom})`,
        transformOrigin: 'top left',
        width: `${100 / effectivePageZoom}%`,
        height: `${100 / effectivePageZoom}%`,
      }}
    >
      {sidebarOpen && compactViewport && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] md:hidden"
        />
      )}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        workspaces={workspaces}
        collabSpaces={collabSpaces}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={(id) => {
          setActiveWorkspace(id)
          if (compactViewport) setSidebarOpen(false)
        }}
        onAddWorkspace={(w) => setWorkspaces((ws) => [...ws, w])}
        onDeleteWorkspace={(id) => {
          setWorkspaces((ws) => ws.filter((w) => w.id !== id))
          if (activeWorkspace === id) setActiveWorkspace(workspaces.find((w) => w.id !== id)?.id ?? null)
        }}
        onAddCollab={(c) => setCollabSpaces((cs) => [...cs, c])}
        onLogout={onLogout}
        onSelectRoutine={() => {
          selectRoutine()
          if (compactViewport) setSidebarOpen(false)
        }}
        routineActive={showRoutine}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3 shrink-0"
          style={{
            background: darkMode ? '#161210' : '#f5ede0',
            borderBottom: `1.5px solid ${darkMode ? '#2e2820' : '#e8d5b7'}`,
          }}
        >
          {/* Left: toggle + workspace info */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl hover:bg-black/5 transition-colors shrink-0"
              title="Alternar sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect y="2" width="16" height="1.5" rx="0.75" fill="#7a5c3c" />
                <rect y="7.25" width="16" height="1.5" rx="0.75" fill="#7a5c3c" />
                <rect y="12.5" width="16" height="1.5" rx="0.75" fill="#7a5c3c" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1
                className="text-sm sm:text-base font-bold leading-tight select-none truncate max-w-[9rem] sm:max-w-none"
                style={{ color: darkMode ? '#f0e6d3' : '#2d1a0a', fontFamily: 'Nunito, sans-serif' }}
              >
                {activeWs?.icon} {activeWs?.name ?? 'Quadro'}
              </h1>
              <p className="hidden sm:block text-xs leading-none" style={{ color: darkMode ? '#8a7a6a' : '#9a7a5a' }}>
                {visiblePostIts.filter((p) => !p.completed).length} ativas ·{' '}
                {visiblePostIts.filter((p) => p.completed).length} realizadas
              </p>
            </div>
          </div>

          {/* Center: accessibility toolbar */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Keyboard shortcuts */}
            <button
              onClick={() => setShowShortcuts(true)}
              title="Atalhos de teclado"
              className="flex items-center justify-center w-8 h-8 rounded-xl transition-all hover:bg-black/6"
              style={{ color: darkMode ? '#9a8878' : '#7a5c3c' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="3" />
                <path d="M7 8h.01M12 8h.01M17 8h.01M7 12h.01M12 12h.01M17 12h.01M7 16h10" />
              </svg>
            </button>

            {/* Dark mode toggle */}
            <button
              onClick={() => { setDarkMode((v) => !v); showToast(darkMode ? 'Modo claro ativado' : 'Modo escuro ativado', 'info') }}
              title={darkMode ? 'Desativar modo escuro' : 'Ativar modo escuro'}
              className="flex items-center justify-center w-8 h-8 rounded-xl transition-all"
              style={{
                color: darkMode ? '#f0c060' : '#7a5c3c',
                background: darkMode ? 'rgba(240,192,96,0.14)' : 'transparent',
              }}
            >
              {darkMode ? (
                /* Sun icon */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                /* Moon icon */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Page zoom out */}
            <button
              onClick={() => setPageZoom((z) => clampZoom(+(z - 0.1).toFixed(1)))}
              title="Diminuir zoom da página"
              disabled={pageZoom <= 0.6}
              className="flex items-center justify-center w-8 h-8 rounded-xl transition-all hover:bg-black/6 disabled:opacity-30"
              style={{ color: darkMode ? '#9a8878' : '#7a5c3c' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>

            {/* Page zoom label */}
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: darkMode ? '#7a6858' : '#9a7a5a', fontFamily: 'Outfit, sans-serif', minWidth: 36, textAlign: 'center' }}
            >
              {Math.round(pageZoom * 100)}%
            </span>

            {/* Page zoom in */}
            <button
              onClick={() => setPageZoom((z) => clampZoom(+(z + 0.1).toFixed(1)))}
              title="Aumentar zoom da página"
              disabled={pageZoom >= 1.5}
              className="flex items-center justify-center w-8 h-8 rounded-xl transition-all hover:bg-black/6 disabled:opacity-30"
              style={{ color: darkMode ? '#9a8878' : '#7a5c3c' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>

            {/* Reset page zoom */}
            {pageZoom !== 1 && (
              <button
                onClick={() => setPageZoom(1)}
                title="Zoom padrão"
                className="text-xs font-semibold px-2 h-8 rounded-xl transition-all hover:bg-black/6"
                style={{ color: '#e07b39', fontFamily: 'Outfit, sans-serif' }}
              >
                ↺
              </button>
            )}

            {/* Divider */}
            <div style={{ width: 1, height: 20, background: darkMode ? '#3a3028' : '#e8d5b7', margin: '0 4px' }} />

            {/* VLibras hint button (the actual widget loads via script) */}
            <button
              title="VLibras — Tradução em Libras"
              className="flex items-center justify-center w-8 h-8 rounded-xl transition-all hover:bg-black/6"
              style={{ color: darkMode ? '#9a8878' : '#7a5c3c' }}
              onClick={() => {
                const btn = document.querySelector('[vw-access-button]') as HTMLElement | null
                btn?.click()
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a5 5 0 0 1 5 5v2a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
                <path d="M8 14c-3 1-5 3-5 5h18c0-2-2-4-5-5" />
                <path d="M9 17l1 2 2-4 2 4 1-2" />
              </svg>
            </button>
          </div>

          {/* Right: export + new post-it */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Export dropdown */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setExportOpen((v) => !v)}
                disabled={exporting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                style={{
                  background: darkMode ? '#2e2820' : '#f0e6d3',
                  color: darkMode ? '#c4a880' : '#7a5c3c',
                  fontFamily: 'Nunito, sans-serif',
                  border: `1.5px solid ${darkMode ? '#3e3228' : '#e8d5b7'}`,
                }}
              >
                {exporting ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Exportando…
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Exportar
                    <span style={{ fontSize: 9, opacity: 0.5 }}>{exportOpen ? '▲' : '▼'}</span>
                  </>
                )}
              </button>

              {exportOpen && !exporting && (
                <div
                  className="absolute right-0 mt-1.5 rounded-xl overflow-hidden z-50"
                  style={{
                    width: 168,
                    background: darkMode ? 'rgba(30,24,18,0.97)' : 'rgba(255,252,248,0.97)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${darkMode ? '#3e3228' : '#e8d5b7'}`,
                    boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                    animation: 'popIn 0.15s ease',
                  }}
                >
                  {[
                    { fmt: 'png' as const, icon: '🖼', label: 'PNG', desc: 'Imagem alta resolução' },
                    { fmt: 'svg' as const, icon: '✏️', label: 'SVG', desc: 'Vetor escalável' },
                    { fmt: 'pdf' as const, icon: '📄', label: 'PDF', desc: 'Documento para impressão' },
                  ].map(({ fmt, icon, label, desc }) => (
                    <button
                      key={fmt}
                      onClick={() => handleExport(fmt)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-black/5"
                    >
                      <span style={{ fontSize: 16 }}>{icon}</span>
                      <div>
                        <div className="font-bold" style={{ color: darkMode ? '#f0e6d3' : '#2d1a0a', fontFamily: 'Nunito, sans-serif', fontSize: 12 }}>
                          {label}
                        </div>
                        <div style={{ color: darkMode ? '#7a6858' : '#9a7a5a', fontFamily: 'Outfit, sans-serif', fontSize: 9 }}>
                          {desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center justify-center gap-1.5 min-w-10 h-10 px-3 sm:px-4 sm:py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
              style={{ background: '#e07b39', color: '#fff', fontFamily: 'Nunito, sans-serif' }}
            >
              <span className="text-lg sm:text-base leading-none">+</span>
              <span className="hidden sm:inline">Novo post-it</span>
            </button>
          </div>
        </div>

        {/* Tabs bar — always visible */}
        {(() => {
          const isBoard = activeDocId === null && activeSheetId === null && !showRoutine && !showQuiz && !showWhiteboard && !showStudySession
          const isRoutine = showRoutine
          const isQuiz = showQuiz
          const isWhiteboard = showWhiteboard
          const isStudySession = showStudySession
          const tabActiveSt = (active: boolean) => ({
            fontFamily: 'Nunito, sans-serif',
            background: active ? (darkMode ? '#1e1a16' : '#fff') : 'transparent',
            color: active ? '#e07b39' : (darkMode ? '#7a6858' : '#9a7a5a'),
            borderTop: active ? `1.5px solid ${darkMode ? '#3a3028' : '#e8d5b7'}` : '1.5px solid transparent',
            borderLeft: active ? `1.5px solid ${darkMode ? '#3a3028' : '#e8d5b7'}` : '1.5px solid transparent',
            borderRight: active ? `1.5px solid ${darkMode ? '#3a3028' : '#e8d5b7'}` : '1.5px solid transparent',
            borderBottom: 'none',
          })
          const closeTabSt = (active: boolean) => ({
            background: active ? (darkMode ? '#1e1a16' : '#fff') : 'transparent',
            color: darkMode ? '#c4a880' : '#9a7a5a',
            borderTop: active ? `1.5px solid ${darkMode ? '#3a3028' : '#e8d5b7'}` : '1.5px solid transparent',
            borderRight: active ? `1.5px solid ${darkMode ? '#3a3028' : '#e8d5b7'}` : '1.5px solid transparent',
            borderBottom: 'none', borderLeft: 'none', fontSize: 10,
          })
          return (
            <div className="shrink-0 flex items-end gap-0.5 px-1.5 sm:px-3 overflow-x-auto"
              style={{ background: darkMode ? '#161210' : '#f5ede0', borderBottom: `1px solid ${darkMode ? '#2e2820' : '#e8d5b7'}`, minHeight: 36 }}>

              {/* Board tab */}
              <button onClick={selectBoard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl text-xs font-semibold transition-all shrink-0"
                style={tabActiveSt(isBoard)}>
                📋 Quadro
              </button>

              {/* Quiz tab — fixed, always visible */}
              <button onClick={selectQuiz}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl text-xs font-semibold transition-all shrink-0"
                style={tabActiveSt(isQuiz)}>
                📝 Questionários
              </button>

              {/* Whiteboard tab — fixed, always visible */}
              <button onClick={selectWhiteboard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl text-xs font-semibold transition-all shrink-0"
                style={tabActiveSt(isWhiteboard)}>
                🖊 Quadro Branco
              </button>

              {/* Study session tab — fixed, always visible */}
              <button onClick={selectStudySession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl text-xs font-semibold transition-all shrink-0"
                style={tabActiveSt(isStudySession)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2.5 1.5M9 2h6M12 2v3" />
                </svg>
                Sessão de Estudos
              </button>

              {/* Document tabs */}
              {documents.map((d) => {
                const active = activeDocId === d.id
                return (
                  <div key={d.id} className="flex items-center shrink-0 group">
                    <button onClick={() => selectDoc(d.id)}
                      className="flex items-center gap-1.5 pl-3 pr-1 py-1.5 rounded-tl-xl text-xs font-semibold transition-all"
                      style={{ ...tabActiveSt(active), maxWidth: 160, borderRight: 'none' }}>
                      <span style={{ fontSize: 11 }}>📄</span>
                      <span className="truncate" style={{ maxWidth: 100 }}>{d.title}</span>
                    </button>
                    <button onClick={() => handleDeleteDoc(d.id)}
                      className="flex items-center justify-center w-5 h-5 rounded-lg opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity mr-0.5"
                      style={closeTabSt(active)} title="Fechar">✕</button>
                  </div>
                )
              })}

              {/* Spreadsheet tabs */}
              {sheets.map((s) => {
                const active = activeSheetId === s.id
                return (
                  <div key={s.id} className="flex items-center shrink-0 group">
                    <button onClick={() => selectSheet(s.id)}
                      className="flex items-center gap-1.5 pl-3 pr-1 py-1.5 rounded-tl-xl text-xs font-semibold transition-all"
                      style={{ ...tabActiveSt(active), maxWidth: 160, borderRight: 'none' }}>
                      <span style={{ fontSize: 11 }}>📊</span>
                      <span className="truncate" style={{ maxWidth: 100 }}>{s.title}</span>
                    </button>
                    <button onClick={() => handleDeleteSheet(s.id)}
                      className="flex items-center justify-center w-5 h-5 rounded-lg opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity mr-0.5"
                      style={closeTabSt(active)} title="Fechar">✕</button>
                  </div>
                )
              })}

            </div>
          )
        })()}

        {/* Active document editor */}
        {activeDocId !== null && (() => {
          const doc = documents.find((d) => d.id === activeDocId)
          if (!doc) return null
          return (
            <Suspense fallback={<SplashScreen label="Carregando editor…" />}>
              <TextEditor
                doc={doc}
                onUpdate={handleUpdateDoc}
                onClose={() => setActiveDocId(null)}
                darkMode={darkMode}
                exportRef={boardExportRef}
              />
            </Suspense>
          )
        })()}

        {/* Active spreadsheet */}
        {activeSheetId !== null && (() => {
          const sheet = sheets.find((s) => s.id === activeSheetId)
          if (!sheet) return null
          return (
            <Suspense fallback={<SplashScreen label="Carregando planilha…" />}>
              <SpreadsheetEditor
                sheet={sheet}
                onUpdate={handleUpdateSheet}
                darkMode={darkMode}
                exportRef={boardExportRef}
              />
            </Suspense>
          )
        })()}

        {/* Routine tab */}
        {showRoutine && activeDocId === null && activeSheetId === null && (
          <Suspense fallback={<SplashScreen label="Carregando rotina…" />}>
            <RoutineTab darkMode={darkMode} postIts={visiblePostIts} onComplete={handleComplete} />
          </Suspense>
        )}

        {/* Quiz tab */}
        {showQuiz && activeDocId === null && activeSheetId === null && (
          <Suspense fallback={<SplashScreen label="Carregando questionários…" />}>
            <QuizTab darkMode={darkMode} />
          </Suspense>
        )}

        {/* Whiteboard tab */}
        {showWhiteboard && activeDocId === null && activeSheetId === null && (
          <Suspense fallback={<SplashScreen label="Carregando quadro branco…" />}>
            <WhiteboardTab darkMode={darkMode} />
          </Suspense>
        )}

        {/* Study session tab */}
        {showStudySession && activeDocId === null && activeSheetId === null && (
          <Suspense fallback={<SplashScreen label="Carregando sessão de estudos…" />}>
            <StudySessionTab darkMode={darkMode} />
          </Suspense>
        )}

        {/* Board — hidden when a document, sheet, routine, quiz, whiteboard, or study session is active */}
        {activeDocId === null && activeSheetId === null && !showRoutine && !showQuiz && !showWhiteboard && !showStudySession && <Board
          postIts={visiblePostIts}
          onMove={handleMove}
          onSelect={(p) => setDetailPostIt(p.id)}
          onComplete={handleComplete}
          onDelete={handleDelete}
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          notes={notes}
          onNotesChange={setNotes}
          links={links}
          onLinksChange={setLinks}
          showToast={showToast}
          darkMode={darkMode}
          exportRef={boardExportRef}
        />}
      </div>

      {createOpen && <CreatePostItModal onClose={() => setCreateOpen(false)} onCreate={handleCreate} />}

      {detailPost && (
        <PostItDetailModal
          postIt={detailPost}
          onClose={() => setDetailPostIt(null)}
          onComplete={handleComplete}
          onDelete={handleDelete}
          onUpdate={(updated) => setPostIts((p) => p.map((pi) => (pi.id === updated.id ? updated : pi)))}
        />
      )}

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(45,31,20,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: darkMode ? '#1e1a16' : '#fef9f3',
              boxShadow: '0 28px 72px rgba(0,0,0,0.45)',
              animation: 'popIn 0.22s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4" style={{ borderBottom: `1.5px solid ${darkMode ? '#2e2820' : '#e8d5b7'}` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 18 }}>⌨️</span>
                  <h3 className="text-base font-black" style={{ fontFamily: 'Nunito, sans-serif', color: darkMode ? '#f0e6d3' : '#2d1a0a' }}>
                    Atalhos e Interações
                  </h3>
                </div>
                <button onClick={() => setShowShortcuts(false)} className="opacity-35 hover:opacity-80 transition-opacity" style={{ color: '#1a0f00' }}>✕</button>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {SHORTCUTS.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="flex gap-1 flex-wrap">
                    {s.keys.map((k) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 rounded-lg text-xs font-bold"
                        style={{
                          background: darkMode ? '#2e2820' : '#f0e6d3',
                          color: darkMode ? '#c4a880' : '#5a3e28',
                          fontFamily: 'Outfit, sans-serif',
                          border: `1px solid ${darkMode ? '#3e3228' : '#e8d5b7'}`,
                        }}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-right" style={{ color: darkMode ? '#8a7a6a' : '#7a5c3c', fontFamily: 'Outfit, sans-serif' }}>
                    {s.action}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4">
              <button
                onClick={() => setShowShortcuts(false)}
                className="w-full py-2.5 rounded-xl text-sm font-bold"
                style={{ background: '#2d1a0a', color: '#f0e6d3', fontFamily: 'Nunito, sans-serif' }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast stack */}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-[100]">
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} type={t.type} />
        ))}
      </div>
    </div>
    </>
  )
}
