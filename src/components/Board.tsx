import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { toPng, toSvg } from 'html-to-image'
import jsPDF from 'jspdf'
import type { PostIt, Note, QuickLink } from '../types'
import PostItCard from './PostItCard'
import CalendarPanel from './panels/CalendarPanel'
import NotesPanel from './panels/NotesPanel'
import QuickLinksPanel from './panels/QuickLinksPanel'

export type BoardExportFn = (format: 'png' | 'svg' | 'pdf') => Promise<void>

interface Props {
  postIts: PostIt[]
  onMove: (id: string, x: number, y: number) => void
  onSelect: (p: PostIt) => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  activePanel: 'calendar' | 'notes' | 'links'
  onPanelChange: (p: 'calendar' | 'notes' | 'links') => void
  notes: Note[]
  onNotesChange: (notes: Note[]) => void
  links: QuickLink[]
  onLinksChange: (links: QuickLink[]) => void
  showToast: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void
  darkMode: boolean
  exportRef: React.MutableRefObject<BoardExportFn | null>
}

const FLOAT_LIST_THRESHOLD = 10

export default function Board({
  postIts,
  onMove,
  onSelect,
  onComplete,
  onDelete,
  activePanel,
  onPanelChange,
  notes,
  onNotesChange,
  links,
  onLinksChange,
  showToast,
  darkMode,
  exportRef,
}: Props) {
  const dk = darkMode
  const boardRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [trashHover, setTrashHover] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const hasDragged = useRef(false)
  const justDragged = useRef(false)

  const [zoom, setZoom] = useState(0)
  const [panelsExpanded, setPanelsExpanded] = useState(true)
  const [listHovered, setListHovered] = useState(false)
  const [listVisible, setListVisible] = useState(true)
  const [exporting, setExporting] = useState(false)
  const rafRef = useRef<number | null>(null)

  const handleExport: BoardExportFn = useCallback(async (format) => {
    if (!boardRef.current) return
    setExporting(true)

    // Exclude UI chrome elements (export button, list toggle, trash label, zone labels)
    const filter = (node: HTMLElement) => {
      if (node.dataset?.exportExclude === 'true') return false
      return true
    }

    try {
      const el = boardRef.current
      const w = el.offsetWidth
      const h = el.offsetHeight

      if (format === 'png') {
        const dataUrl = await toPng(el, { pixelRatio: 2, filter })
        const a = document.createElement('a')
        a.download = 'pinfast-board.png'
        a.href = dataUrl
        a.click()
        showToast('Board exportado como PNG ✓', 'success')
      } else if (format === 'svg') {
        const dataUrl = await toSvg(el, { filter })
        const a = document.createElement('a')
        a.download = 'pinfast-board.svg'
        a.href = dataUrl
        a.click()
        showToast('Board exportado como SVG ✓', 'success')
      } else if (format === 'pdf') {
        const dataUrl = await toPng(el, { pixelRatio: 2, filter })
        const orientation = w > h ? 'landscape' : 'portrait'
        const pdf = new jsPDF({ orientation, unit: 'px', format: [w, h] })
        pdf.addImage(dataUrl, 'PNG', 0, 0, w, h)
        pdf.save('pinfast-board.pdf')
        showToast('Board exportado como PDF ✓', 'success')
      }
    } catch {
      showToast('Erro ao exportar. Tente novamente.', 'error')
    } finally {
      setExporting(false)
    }
  }, [showToast])

  // Expose handleExport to parent via ref
  useEffect(() => {
    exportRef.current = handleExport
  }, [exportRef, handleExport])

  const zoomToScale = (z: number) => {
    if (z >= 0) return 1 + (z / 100) * 1.0
    return 1 + (z / 100) * 0.6
  }
  const scale = zoomToScale(zoom)

  const handleMouseDown = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (!boardRef.current) return
      const rect = boardRef.current.getBoundingClientRect()
      const postIt = postIts.find((p) => p.id === id)
      if (!postIt) return

      draggingRef.current = {
        id,
        offsetX: (e.clientX - rect.left) - postIt.x,
        offsetY: (e.clientY - rect.top) - postIt.y,
      }
      hasDragged.current = false
      setDraggingId(id)
      e.preventDefault()
      e.stopPropagation()
    },
    [postIts]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingRef.current) return
      hasDragged.current = true
      // Capture coords synchronously — synthetic event may be nullified by React
      const clientX = e.clientX
      const clientY = e.clientY
      if (rafRef.current !== null) return  // already scheduled
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        if (!draggingRef.current || !boardRef.current) return
        const rect = boardRef.current.getBoundingClientRect()
        const x = clientX - rect.left - draggingRef.current.offsetX
        const y = clientY - rect.top - draggingRef.current.offsetY
        onMove(draggingRef.current.id, x, y)
        const isOverTrash = clientX - rect.left > rect.width - 88 && clientY - rect.top > rect.height - 88
        setTrashHover(isOverTrash)
      })
    },
    [onMove]
  )

  // Cancel pending rAF on unmount
  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }, [])

  const handleMouseLeave = useCallback(() => {
    if (!draggingRef.current) return
    justDragged.current = hasDragged.current
    draggingRef.current = null
    hasDragged.current = false
    setDraggingId(null)
    setTrashHover(false)
  }, [])

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingRef.current || !boardRef.current) return
      const rect = boardRef.current.getBoundingClientRect()
      const id = draggingRef.current.id

      const isOverTrash =
        e.clientX - rect.left > rect.width - 88 &&
        e.clientY - rect.top > rect.height - 88

      justDragged.current = hasDragged.current

      if (isOverTrash && hasDragged.current) {
        draggingRef.current = null
        hasDragged.current = false
        setDraggingId(null)
        setTrashHover(false)
        onDelete(id)
        return
      }

      if (hasDragged.current) {
        const relX = e.clientX - rect.left
        const third = rect.width / 3
        const inRealizedZone = relX >= third * 2
        const inActiveZone = relX < third * 2

        const postIt = postIts.find((p) => p.id === id)
        if (postIt) {
          if (inRealizedZone && !postIt.completed) onComplete(id)
          if (inActiveZone && postIt.completed) onComplete(id)
        }
      }

      draggingRef.current = null
      hasDragged.current = false
      setDraggingId(null)
      setTrashHover(false)
    },
    [onDelete, onComplete, postIts]
  )

  const activePosts = useMemo(() => postIts.filter((p) => !p.completed), [postIts])
  const completedPosts = useMemo(() => postIts.filter((p) => p.completed), [postIts])

  const PANEL_TABS = [
    { key: 'calendar', label: '📅 Calendário' },
    { key: 'notes', label: '📝 Anotações' },
    { key: 'links', label: '🔗 Acessos rápidos' },
  ] as const

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div
        className="md:hidden flex-1 overflow-y-auto px-3 py-3 space-y-4"
        style={{ background: dk ? '#1a1510' : '#c09050' }}
      >
        {postIts.length === 0 && (
          <div className="min-h-52 rounded-3xl flex flex-col items-center justify-center text-center px-6 bg-black/10 border border-white/10">
            <svg className="w-10 h-10 mb-3 text-white/65" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m14 4 6 6-3 1-4 4-1 5-2-2-4-4-2-2 5-1 4-4 1-3Z" />
              <path d="m5 19 4-4" />
            </svg>
            <p className="text-base font-black text-white/85" style={{ fontFamily: 'Nunito, sans-serif' }}>
              Seu quadro está vazio
            </p>
            <p className="text-sm mt-1 text-white/60">Use o botão + para criar seu primeiro post-it.</p>
          </div>
        )}

        {([
          { title: 'Ativas', items: activePosts },
          { title: 'Realizadas', items: completedPosts },
        ] as const).map((group) => (
          group.items.length > 0 && (
            <section key={group.title}>
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-xs font-black uppercase tracking-widest text-white/70">{group.title}</h2>
                <span className="text-xs font-bold text-white/55">{group.items.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {group.items.map((postIt) => {
                  const status = postIt.dueDate
                    ? new Date(`${postIt.dueDate}T${postIt.dueTime || '23:59'}`).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                      })
                    : null
                  return (
                    <article
                      key={postIt.id}
                      className="rounded-2xl p-4 shadow-md border border-black/10"
                      style={{ background: postIt.color }}
                    >
                      <button type="button" onClick={() => onSelect(postIt)} className="w-full text-left">
                        <p
                          className="text-base font-bold leading-snug"
                          style={{
                            color: '#1a0f00',
                            fontFamily: 'Kalam, cursive',
                            textDecoration: postIt.completed ? 'line-through' : 'none',
                          }}
                        >
                          {postIt.title}
                        </p>
                        {postIt.description && (
                          <p className="text-sm mt-1 line-clamp-2" style={{ color: '#5a3e28' }}>
                            {postIt.description}
                          </p>
                        )}
                      </button>
                      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-black/10">
                        <span className="text-xs font-semibold" style={{ color: '#6f4d2f' }}>
                          {status ? `Prazo ${status}` : 'Sem prazo'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onComplete(postIt.id)}
                          className="min-h-10 px-3 rounded-xl text-xs font-black"
                          style={{
                            background: postIt.completed ? 'rgba(45,26,10,0.1)' : '#2d1a0a',
                            color: postIt.completed ? '#5a3e28' : '#fff',
                          }}
                        >
                          {postIt.completed ? 'Reabrir' : 'Concluir'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        ))}

        <section
          className="rounded-3xl overflow-hidden"
          style={{ background: dk ? '#141210' : '#f5ede0', border: `1px solid ${dk ? '#2e2820' : '#e8d5b7'}` }}
        >
          <div className="flex overflow-x-auto px-2 pt-2">
            {PANEL_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onPanelChange(tab.key)}
                className="min-h-11 px-3 rounded-xl text-xs font-bold whitespace-nowrap"
                style={{
                  color: activePanel === tab.key ? '#fff' : dk ? '#9a8878' : '#7a5c3c',
                  background: activePanel === tab.key ? '#e07b39' : 'transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="h-72 overflow-hidden">
            {activePanel === 'calendar' && <CalendarPanel postIts={postIts} />}
            {activePanel === 'notes' && <NotesPanel notes={notes} onNotesChange={onNotesChange} />}
            {activePanel === 'links' && (
              <QuickLinksPanel links={links} onLinksChange={onLinksChange} showToast={showToast} />
            )}
          </div>
        </section>
      </div>

      <div className="hidden md:flex flex-1 relative overflow-hidden">
        <div
          className="flex-1 relative overflow-hidden"
          ref={boardRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{
            background: dk ? '#1a1510' : '#c09050',
            backgroundImage: dk ? `
              radial-gradient(ellipse at 18% 22%, rgba(40,30,15,0.8) 0%, transparent 55%),
              radial-gradient(ellipse at 82% 78%, rgba(30,22,10,0.7) 0%, transparent 50%)
            ` : `
              radial-gradient(ellipse at 18% 22%, rgba(180,135,80,0.55) 0%, transparent 55%),
              radial-gradient(ellipse at 82% 78%, rgba(155,110,55,0.4) 0%, transparent 50%),
              radial-gradient(ellipse at 55% 45%, rgba(210,175,120,0.25) 0%, transparent 65%),
              radial-gradient(circle at 30% 70%, rgba(140,100,50,0.2) 0%, transparent 40%)
            `,
            cursor: draggingId ? 'grabbing' : 'default',
            userSelect: 'none',
          }}
        >
          {/* Section labels + static dividers */}
          <div
            data-export-exclude="true"
            className="absolute inset-x-0 top-0 flex pointer-events-none z-20"
            style={{ height: 28 }}
          >
            <div className="flex items-center justify-center" style={{ width: '33.333%' }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.42)', fontFamily: 'Outfit, sans-serif' }}>
                Ativas — {activePosts.length}
              </span>
            </div>
            <div style={{ width: 2, background: 'rgba(255,255,255,0.28)', borderRadius: 1, margin: '6px 0' }} />
            <div className="flex items-center justify-center" style={{ width: '33.333%' }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.42)', fontFamily: 'Outfit, sans-serif' }}>
                Em Andamento
              </span>
            </div>
            <div style={{ width: 2, background: 'rgba(255,255,255,0.28)', borderRadius: 1, margin: '6px 0' }} />
            <div className="flex items-center justify-center" style={{ width: '33.333%' }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.42)', fontFamily: 'Outfit, sans-serif' }}>
                Realizadas — {completedPosts.length}
              </span>
            </div>
          </div>

          {/* Static vertical dividers */}
          <div data-export-exclude="true" className="absolute top-0 bottom-0 pointer-events-none z-10"
            style={{ left: 'calc(33.333% - 1px)', width: 2, background: 'rgba(255,255,255,0.22)' }} />
          <div data-export-exclude="true" className="absolute top-0 bottom-0 pointer-events-none z-10"
            style={{ left: 'calc(66.666% - 1px)', width: 2, background: 'rgba(255,255,255,0.22)' }} />


          {/* Canvas — post-its */}
          <div style={{ position: 'absolute', inset: 0 }}>
            {postIts.map((p) => (
              <PostItCard
                key={p.id}
                postIt={p}
                isDragging={draggingId === p.id}
                scale={scale}
                onMouseDown={handleMouseDown}
                onSelect={onSelect}
                onComplete={onComplete}
                justDragged={justDragged}
              />
            ))}

            {postIts.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: 'none' }}>
                <div className="text-center">
                  <div className="text-5xl mb-3 opacity-60">📌</div>
                  <p className="text-sm font-bold opacity-50" style={{ color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
                    Seu quadro está vazio
                  </p>
                  <p className="text-xs mt-1 opacity-35" style={{ color: '#fff', fontFamily: 'Outfit, sans-serif' }}>
                    Clique em "+ Novo post-it" para começar
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Floating post-it list toggle button */}
          {postIts.length > FLOAT_LIST_THRESHOLD && (
            <button
              data-export-exclude="true"
              onClick={() => setListVisible((v) => !v)}
              title={listVisible ? 'Recolher lista' : 'Expandir lista de post-its'}
              className="absolute z-40 flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all hover:scale-105"
              style={{
                top: 36,
                left: 12,
                background: 'rgba(45,26,10,0.72)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: 'rgba(255,255,255,0.75)',
                fontFamily: 'Outfit, sans-serif',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.4,
              }}
            >
              <span style={{ fontSize: 11 }}>📋</span>
              {listVisible ? 'Recolher' : `Post-its (${postIts.length})`}
              <span style={{ fontSize: 9, opacity: 0.6 }}>{listVisible ? '▲' : '▼'}</span>
            </button>
          )}

          {/* Floating post-it list — appears when >10 post-its and listVisible */}
          {postIts.length > FLOAT_LIST_THRESHOLD && listVisible && (
            <div
              data-export-exclude="true"
              className="absolute z-30 rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                top: 62,
                left: 12,
                width: 188,
                maxHeight: 260,
                background: 'rgba(45,26,10,0.82)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                opacity: listHovered ? 1 : 0.32,
                transform: listHovered ? 'translateY(0) scale(1)' : 'translateY(-2px) scale(0.97)',
              }}
              onMouseEnter={() => setListHovered(true)}
              onMouseLeave={() => setListHovered(false)}
            >
              <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                {postIts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSelect(p)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-white/10"
                  >
                    <span
                      className="shrink-0 rounded-sm"
                      style={{ width: 10, height: 10, background: p.color, border: '1px solid rgba(255,255,255,0.2)' }}
                    />
                    <span
                      className="text-xs truncate"
                      style={{
                        fontFamily: 'Outfit, sans-serif',
                        color: p.completed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.82)',
                        textDecoration: p.completed ? 'line-through' : 'none',
                      }}
                    >
                      {p.title}
                    </span>
                    {p.completed && (
                      <span className="shrink-0 ml-auto text-green-400" style={{ fontSize: 9 }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trash zone */}
          <div
            data-export-exclude="true"
            className="absolute bottom-3 right-3 w-16 h-16 rounded-xl flex flex-col items-center justify-center transition-all duration-150 z-20"
            style={{
              background: trashHover ? 'rgba(239,68,68,0.85)' : 'rgba(0,0,0,0.18)',
              border: trashHover ? '2px dashed rgba(239,68,68,0.9)' : '2px dashed rgba(255,255,255,0.2)',
              transform: trashHover ? 'scale(1.12)' : 'scale(1)',
              boxShadow: trashHover ? '0 4px 20px rgba(239,68,68,0.4)' : 'none',
            }}
          >
            <span className="text-xl">{trashHover ? '🗑️' : '🗑'}</span>
            <span className="mt-0.5" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, fontFamily: 'Outfit, sans-serif' }}>
              Lixeira
            </span>
          </div>
        </div>

        {/* Zoom bar — right edge */}
        <div
          className="flex flex-col items-center justify-center gap-2 shrink-0 select-none"
          style={{
            width: 36,
            background: dk ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.18)',
            borderLeft: dk ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.08)',
            padding: '12px 0',
          }}
        >
          <button
            onClick={() => setZoom((z) => Math.min(100, z + 10))}
            className="w-6 h-6 rounded-md flex items-center justify-center text-sm font-bold transition-all hover:bg-white/20"
            style={{ color: 'rgba(255,255,255,0.7)' }}
            title="Aumentar zoom"
          >
            +
          </button>

          <div className="flex-1 flex flex-col items-center justify-center relative" style={{ minHeight: 80 }}>
            <input
              type="range"
              min={-100}
              max={100}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
                WebkitAppearance: 'slider-vertical',
                appearance: 'slider-vertical',
                width: 4,
                height: '100%',
                cursor: 'pointer',
                accentColor: '#e07b39',
              } as unknown as React.CSSProperties}
              title={`Zoom: ${zoom > 0 ? '+' : ''}${zoom}`}
            />
          </div>

          <button
            onClick={() => setZoom((z) => Math.max(-100, z - 10))}
            className="w-6 h-6 rounded-md flex items-center justify-center text-sm font-bold transition-all hover:bg-white/20"
            style={{ color: 'rgba(255,255,255,0.7)' }}
            title="Diminuir zoom"
          >
            −
          </button>

          <button
            onClick={() => setZoom(0)}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-all hover:bg-white/20"
            style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}
            title="Resetar zoom"
          >
            ↺
          </button>

          <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Outfit, sans-serif', fontSize: 8, writingMode: 'vertical-rl', letterSpacing: 1 }}>
            {zoom > 0 ? `+${zoom}` : zoom}
          </span>
        </div>
      </div>

      {/* Bottom panels */}
      <div
        className="hidden md:flex shrink-0 flex-col relative"
        style={{
          height: panelsExpanded ? 220 : 0,
          background: dk ? '#141210' : '#f5ede0',
          borderTop: panelsExpanded ? `1.5px solid ${dk ? '#2e2820' : '#e8d5b7'}` : 'none',
          transition: 'height 280ms ease',
          overflow: 'visible',
        }}
      >
        <button
          type="button"
          onClick={() => setPanelsExpanded((v) => !v)}
          aria-label={panelsExpanded ? 'Recolher painéis' : 'Expandir painéis'}
          aria-expanded={panelsExpanded}
          title={panelsExpanded ? 'Recolher painéis' : 'Expandir painéis'}
          className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center transition-all hover:scale-105"
          style={{
            top: -10, width: 48, height: 18,
            background: dk ? '#1e1a16' : '#f5ede0',
            border: `1.5px solid ${dk ? '#3a3028' : '#e8d5b7'}`,
            borderRadius: 999,
            boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
            color: dk ? '#9a8070' : '#9a7a5a',
            cursor: 'pointer',
            zIndex: 20,
          }}
        >
          <span style={{ width: 18, height: 3, borderRadius: 999, background: dk ? '#5a4a38' : '#c4a47c' }} />
        </button>

        <div className="flex items-end gap-0.5 px-4 pt-2">
          {PANEL_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => onPanelChange(t.key)}
              className="px-3 py-1.5 rounded-t-xl text-xs font-semibold transition-all"
              style={{
                fontFamily: 'Nunito, sans-serif',
                background: activePanel === t.key ? (dk ? '#1e1a16' : '#fff') : 'transparent',
                color: activePanel === t.key ? '#e07b39' : (dk ? '#7a6858' : '#9a7a5a'),
                borderTop: activePanel === t.key ? `1.5px solid ${dk ? '#3a3028' : '#e8d5b7'}` : '1.5px solid transparent',
                borderLeft: activePanel === t.key ? `1.5px solid ${dk ? '#3a3028' : '#e8d5b7'}` : '1.5px solid transparent',
                borderRight: activePanel === t.key ? `1.5px solid ${dk ? '#3a3028' : '#e8d5b7'}` : '1.5px solid transparent',
                borderBottom: 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          className="flex-1 overflow-hidden mx-3 mb-2"
          style={{
            background: dk ? '#1e1a16' : '#fff',
            border: `1.5px solid ${dk ? '#3a3028' : '#e8d5b7'}`,
            borderRadius: '0 12px 12px 12px',
            opacity: panelsExpanded ? 1 : 0,
            pointerEvents: panelsExpanded ? 'auto' : 'none',
            transition: 'opacity 150ms ease',
          }}
        >
          {activePanel === 'calendar' && <CalendarPanel postIts={postIts} />}
          {activePanel === 'notes' && <NotesPanel notes={notes} onNotesChange={onNotesChange} />}
          {activePanel === 'links' && (
            <QuickLinksPanel links={links} onLinksChange={onLinksChange} showToast={showToast} />
          )}
        </div>
      </div>
    </div>
  )
}
