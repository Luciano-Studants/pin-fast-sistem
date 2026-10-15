import { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react'
import * as store from '../lib/store/store'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = 'pen' | 'highlighter' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'text' | 'select'
type BgMode = 'white' | 'dark' | 'grid' | 'dots' | 'lines'

interface Pt { x: number; y: number }

interface StrokeBase {
  id: string
  color: string
  width: number
  opacity: number
}
interface FreeStroke extends StrokeBase { kind: 'free' | 'eraser' | 'highlighter'; pts: Pt[] }
interface ShapeStroke extends StrokeBase { kind: 'line' | 'rect' | 'ellipse'; x1: number; y1: number; x2: number; y2: number }
interface TextStroke { id: string; kind: 'text'; x: number; y: number; text: string; color: string; size: number; font: string }
type Stroke = FreeStroke | ShapeStroke | TextStroke

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#1a1a1a', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
  '#a16207', '#64748b', '#f9a8d4', '#86efac', '#93c5fd', '#c4b5fd',
]

const WIDTHS = [1, 2, 4, 6, 10, 16, 24]

const BG_LABELS: Record<BgMode, string> = {
  white: 'Branco', dark: 'Escuro', grid: 'Grade', dots: 'Pontos', lines: 'Linhas',
}

function uid() { return Math.random().toString(36).slice(2) }

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke | null, bg: BgMode) {
  if (!s) return
  ctx.save()

  if (s.kind === 'text') {
    ctx.font = `${s.size}px ${s.font}`
    ctx.fillStyle = s.color
    ctx.fillText(s.text, s.x, s.y)
    ctx.restore()
    return
  }

  if (s.kind === 'eraser') {
    const bgColor = bg === 'dark' ? '#1a1a2e' : '#ffffff'
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = bgColor
    ctx.fillStyle = bgColor
    ctx.lineWidth = s.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = 1
    ctx.beginPath()
    const pts = s.pts
    if (pts.length === 1) {
      ctx.arc(pts[0].x, pts[0].y, s.width / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1].x + pts[i].x) / 2
        const my = (pts[i - 1].y + pts[i].y) / 2
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my)
      }
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  ctx.globalAlpha = s.opacity
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineWidth = s.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (s.kind === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply'
  }

  if (s.kind === 'free' || s.kind === 'highlighter') {
    const pts = s.pts
    if (!pts.length) { ctx.restore(); return }
    ctx.beginPath()
    if (pts.length === 1) {
      ctx.arc(pts[0].x, pts[0].y, s.width / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1].x + pts[i].x) / 2
        const my = (pts[i - 1].y + pts[i].y) / 2
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my)
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
      ctx.stroke()
    }
  } else if (s.kind === 'line') {
    ctx.beginPath()
    ctx.moveTo(s.x1, s.y1)
    ctx.lineTo(s.x2, s.y2)
    ctx.stroke()
  } else if (s.kind === 'rect') {
    ctx.beginPath()
    ctx.strokeRect(s.x1, s.y1, s.x2 - s.x1, s.y2 - s.y1)
  } else if (s.kind === 'ellipse') {
    const rx = Math.abs(s.x2 - s.x1) / 2
    const ry = Math.abs(s.y2 - s.y1) / 2
    const cx = (s.x1 + s.x2) / 2
    const cy = (s.y1 + s.y2) / 2
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, bg: BgMode) {
  ctx.clearRect(0, 0, w, h)

  if (bg === 'white' || bg === 'grid' || bg === 'dots' || bg === 'lines') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  } else if (bg === 'dark') {
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)
  }

  if (bg === 'grid') {
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
    for (let y = 0; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
  } else if (bg === 'dots') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    for (let x = 30; x < w; x += 30) {
      for (let y = 30; y < h; y += 30) {
        ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill()
      }
    }
  } else if (bg === 'lines') {
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 1
    for (let y = 40; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { darkMode: boolean }

export default function WhiteboardTab({ darkMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#1a1a1a')
  const [width, setWidth] = useState(4)
  const [opacity, setOpacity] = useState(1)
  const [bg, setBg] = useState<BgMode>(() => {
    return store.get<BgMode>('wb-bg-v1', 'white')
  })

  const [strokes, setStrokes] = useState<Stroke[]>(() => {
    const saved = store.get<Stroke[]>('wb-strokes-v1', [])
    return Array.isArray(saved) ? saved : []
  })
  const [undone, setUndone] = useState<Stroke[]>([])

  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [showWidthPicker, setShowWidthPicker] = useState(false)
  const [customColor, setCustomColor] = useState('#1a1a1a')

  // Text tool state
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null)
  const [textValue, setTextValue] = useState('')
  const [textSize, setTextSize] = useState(20)

  // Persist strokes + bg
  useEffect(() => {
    store.set('wb-strokes-v1', strokes)
  }, [strokes])
  useEffect(() => {
    store.set('wb-bg-v1', bg)
  }, [bg])

  // Current stroke being drawn (not yet committed)
  const drawing = useRef(false)
  const currentStroke = useRef<Stroke | null>(null)

  // ── Canvas size ──────────────────────────────────────────────────────────────
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setCanvasSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Redraw ───────────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawBackground(ctx, canvas.width, canvas.height, bg)
    for (const s of strokes) drawStroke(ctx, s, bg)
  }, [strokes, bg])

  useEffect(() => { redraw() }, [redraw, canvasSize])

  // ── Pointer helpers ──────────────────────────────────────────────────────────
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'select') return
    if (tool === 'text') {
      const pt = getPos(e)
      setTextInput(pt)
      setTextValue('')
      return
    }
    drawing.current = true
    ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
    const pt = getPos(e)

    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
      const kind = tool === 'pen' ? 'free' : tool === 'highlighter' ? 'highlighter' : 'eraser'
      currentStroke.current = { id: uid(), kind, color, width, opacity, pts: [pt] } as FreeStroke
    } else {
      currentStroke.current = { id: uid(), kind: tool as 'line' | 'rect' | 'ellipse', color, width, opacity, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y } as ShapeStroke
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !currentStroke.current) return
    const pt = getPos(e)
    const s = currentStroke.current

    if (s.kind === 'free' || s.kind === 'highlighter' || s.kind === 'eraser') {
      s.pts = [...s.pts, pt]
    } else {
      ;(s as ShapeStroke).x2 = pt.x
      ;(s as ShapeStroke).y2 = pt.y
    }

    // Live preview
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    drawBackground(ctx, canvas.width, canvas.height, bg)
    for (const committed of strokes) drawStroke(ctx, committed, bg)
    drawStroke(ctx, s, bg)
  }

  const onPointerUp = () => {
    if (!drawing.current) return
    drawing.current = false
    const s = currentStroke.current
    currentStroke.current = null
    if (!s) return
    setStrokes((prev) => [...prev, s])
    setUndone([])
  }

  // ── Text commit ──────────────────────────────────────────────────────────────
  const commitText = () => {
    if (!textInput || !textValue.trim()) { setTextInput(null); return }
    const s: TextStroke = {
      id: uid(), kind: 'text',
      x: textInput.x, y: textInput.y,
      text: textValue.trim(),
      color, size: textSize, font: 'Outfit, sans-serif',
    }
    setStrokes((prev) => [...prev, s])
    setUndone([])
    setTextInput(null)
    setTextValue('')
  }

  // ── Undo / Redo ──────────────────────────────────────────────────────────────
  const undo = () => {
    setStrokes((prev) => {
      if (!prev.length) return prev
      const last = prev[prev.length - 1]
      setUndone((u) => [...u, last])
      return prev.slice(0, -1)
    })
  }
  const redo = () => {
    setUndone((prev) => {
      if (!prev.length) return prev
      const last = prev[prev.length - 1]
      setStrokes((s) => [...s, last])
      return prev.slice(0, -1)
    })
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo() }
      if (e.key === 'Escape') setTextInput(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportPng = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'quadro-branco.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  // ── Styling ──────────────────────────────────────────────────────────────────
  const dm = darkMode
  const uiBg = dm ? '#1e1a16' : '#f5ede0'
  const uiBorder = dm ? '#2e2820' : '#e8d5b7'
  const uiText = dm ? '#f0e6d3' : '#2d1a0a'
  const uiSub = dm ? '#8a7a6a' : '#9a7a5a'
  const accent = '#e07b39'

  const toolBtn = (t: Tool, label: string, icon: React.ReactNode) => (
    <button
      key={t}
      onClick={() => setTool(t)}
      title={label}
      className="shrink-0 flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl transition-all hover:opacity-90"
      style={{
        background: tool === t ? (dm ? '#3a3028' : '#fff') : 'transparent',
        color: tool === t ? accent : uiSub,
        border: tool === t ? `1.5px solid ${accent}` : '1.5px solid transparent',
      }}
    >
      {icon}
      <span style={{ fontSize: 9, fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>{label}</span>
    </button>
  )

  const cursor =
    tool === 'eraser' ? 'cell' :
    tool === 'text' ? 'text' :
    tool === 'select' ? 'default' :
    'crosshair'

  return (
    <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden" style={{ background: dm ? '#161210' : '#f0e6d3' }}>

      {/* ── Left toolbar ── */}
      <div
        className="w-full sm:w-[72px] flex flex-row sm:flex-col gap-1 py-2 sm:py-3 px-2 shrink-0 overflow-x-auto sm:overflow-x-hidden sm:overflow-y-auto"
        style={{ background: uiBg, borderRight: `1px solid ${uiBorder}`, borderBottom: `1px solid ${uiBorder}` }}
      >
        {/* Drawing tools */}
        <p className="hidden sm:block text-[9px] font-bold text-center mb-1 uppercase" style={{ color: uiSub, letterSpacing: 1 }}>Ferramentas</p>

        {toolBtn('pen', 'Caneta',
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        )}
        {toolBtn('highlighter', 'Marca-texto',
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.232 5.232l3.536 3.536-8.5 8.5H6.732v-3.536l8.5-8.5z" opacity={0.5}/>
            <path d="M18.768 8.768l-3.536-3.536 1.414-1.414a2 2 0 0 1 2.828 0l.708.708a2 2 0 0 1 0 2.828l-1.414 1.414zM3 21h18v-1H3v1z"/>
          </svg>
        )}
        {toolBtn('eraser', 'Borracha',
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 20H7L3 16l10-10 7 7-3 3z"/><path d="M6.0 11L13 18"/>
          </svg>
        )}
        {toolBtn('text', 'Texto',
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
          </svg>
        )}

        <div style={{ height: 1, background: uiBorder, margin: '4px 0' }} />
        <p className="hidden sm:block text-[9px] font-bold text-center uppercase" style={{ color: uiSub, letterSpacing: 1 }}>Formas</p>

        {toolBtn('line', 'Linha',
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="4" y1="20" x2="20" y2="4"/>
          </svg>
        )}
        {toolBtn('rect', 'Retângulo',
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        )}
        {toolBtn('ellipse', 'Elipse',
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <ellipse cx="12" cy="12" rx="10" ry="6"/>
          </svg>
        )}

        <div style={{ height: 1, background: uiBorder, margin: '4px 0' }} />

        {/* Undo / redo */}
        <button onClick={undo} title="Desfazer (Ctrl+Z)" disabled={!strokes.length}
          className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl hover:bg-black/8 disabled:opacity-25 transition-all"
          style={{ color: uiSub }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
          </svg>
          <span style={{ fontSize: 9, fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>Desfazer</span>
        </button>
        <button onClick={redo} title="Refazer (Ctrl+Y)" disabled={!undone.length}
          className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl hover:bg-black/8 disabled:opacity-25 transition-all"
          style={{ color: uiSub }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>
          </svg>
          <span style={{ fontSize: 9, fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>Refazer</span>
        </button>

        <div style={{ height: 1, background: uiBorder, margin: '4px 0' }} />

        <button onClick={exportPng} title="Exportar PNG"
          className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl hover:bg-black/8 transition-all"
          style={{ color: uiSub }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span style={{ fontSize: 9, fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>Exportar</span>
        </button>

        <button onClick={() => { if (confirm('Limpar o quadro?')) { setStrokes([]); setUndone([]) } }} title="Limpar tudo"
          className="flex flex-col items-center gap-1 px-2 py-2 rounded-xl hover:bg-red-500/10 transition-all"
          style={{ color: '#ef4444' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
          </svg>
          <span style={{ fontSize: 9, fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>Limpar</span>
        </button>
      </div>

      {/* ── Main canvas area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top property bar — overflow:visible so dropdowns aren't clipped */}
        <div className="shrink-0 flex items-center gap-2 px-2 sm:px-3 py-2 overflow-x-auto"
          style={{ background: uiBg, borderBottom: `1px solid ${uiBorder}`, minHeight: 48, position: 'relative', zIndex: 30 }}>

          {/* ── Color ── */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setShowColorPicker((v) => !v); setShowWidthPicker(false); setShowBgPicker(false) }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:opacity-80 transition-opacity"
              style={{ background: dm ? '#2e2820' : '#fff', border: `1.5px solid ${uiBorder}` }}
              title="Cor"
            >
              <div className="w-5 h-5 rounded-full shrink-0" style={{ background: color, border: '2px solid rgba(0,0,0,0.15)' }} />
              <span className="text-xs font-semibold hidden sm:inline" style={{ color: uiText, fontFamily: 'Outfit, sans-serif' }}>Cor</span>
            </button>
            {showColorPicker && (
              <div className="absolute mt-1 z-50 rounded-2xl p-3 shadow-2xl"
                style={{ top: '100%', left: 0, background: dm ? '#252018' : '#fff', border: `1px solid ${uiBorder}`, width: 204 }}>
                <p className="text-[10px] font-bold mb-2" style={{ color: uiSub }}>Predefinidas</p>
                <div className="grid grid-cols-8 gap-1.5 mb-3">
                  {PRESET_COLORS.map((c) => (
                    <button key={c} onClick={() => { setColor(c); setCustomColor(c) }}
                      className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                      style={{ background: c, border: color === c ? '2.5px solid #e07b39' : '1.5px solid rgba(0,0,0,0.2)' }} />
                  ))}
                </div>
                <p className="text-[10px] font-bold mb-1.5" style={{ color: uiSub }}>Personalizada</p>
                <div className="flex items-center gap-2">
                  <input type="color" value={customColor}
                    onChange={(e) => { setCustomColor(e.target.value); setColor(e.target.value) }}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0" style={{ padding: 2 }} />
                  <input value={customColor} onChange={(e) => { setCustomColor(e.target.value); setColor(e.target.value) }}
                    className="flex-1 text-xs px-2 py-1 rounded-lg outline-none"
                    style={{ background: dm ? '#1e1a16' : '#f5f5f5', color: uiText, border: `1px solid ${uiBorder}`, fontFamily: 'Outfit, sans-serif' }}
                    maxLength={7} />
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="shrink-0" style={{ width: 1, height: 22, background: uiBorder }} />

          {/* ── Width ── */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setShowWidthPicker((v) => !v); setShowColorPicker(false); setShowBgPicker(false) }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:opacity-80 transition-opacity"
              style={{ background: dm ? '#2e2820' : '#fff', border: `1.5px solid ${uiBorder}` }}
              title="Espessura"
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <div className="rounded-full" style={{ width: Math.min(width, 16), height: Math.min(width, 16), background: color }} />
              </div>
              <span className="text-xs font-semibold tabular-nums" style={{ color: uiText, fontFamily: 'Outfit, sans-serif' }}>{width}px</span>
            </button>
            {showWidthPicker && (
              <div className="absolute mt-1 z-50 rounded-2xl p-3 shadow-2xl"
                style={{ top: '100%', left: 0, background: dm ? '#252018' : '#fff', border: `1px solid ${uiBorder}`, width: 210 }}>
                <p className="text-[10px] font-bold mb-2" style={{ color: uiSub }}>Espessura do traço</p>
                <div className="flex gap-2 flex-wrap mb-3">
                  {WIDTHS.map((w) => (
                    <button key={w} onClick={() => setWidth(w)}
                      className="flex items-center justify-center w-9 h-9 rounded-xl hover:opacity-80 transition-all"
                      style={{ background: width === w ? accent + '20' : dm ? '#1e1a16' : '#f5f5f5', border: width === w ? `1.5px solid ${accent}` : `1px solid ${uiBorder}` }}>
                      <div className="rounded-full" style={{ width: Math.min(w, 24), height: Math.min(w, 24), background: color }} />
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-bold mb-1" style={{ color: uiSub }}>Livre: {width}px</p>
                <input type="range" min={1} max={60} value={width} onChange={(e) => setWidth(Number(e.target.value))}
                  className="w-full accent-orange-500" />
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="shrink-0" style={{ width: 1, height: 22, background: uiBorder }} />

          {/* ── Opacity inline (hidden for eraser) ── */}
          {tool !== 'eraser' && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: uiSub, fontFamily: 'Outfit, sans-serif' }}>
                Opac. {Math.round(opacity * 100)}%
              </span>
              <input type="range" min={0.1} max={1} step={0.05} value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                style={{ width: 80 }} className="accent-orange-500" />
            </div>
          )}

          {/* ── Text size inline (text tool only) ── */}
          {tool === 'text' && (
            <>
              <div className="shrink-0" style={{ width: 1, height: 22, background: uiBorder }} />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: uiSub, fontFamily: 'Outfit, sans-serif' }}>
                  Texto {textSize}px
                </span>
                <input type="range" min={10} max={80} value={textSize} onChange={(e) => setTextSize(Number(e.target.value))}
                  style={{ width: 80 }} className="accent-orange-500" />
              </div>
            </>
          )}

          <div style={{ flex: 1 }} />

          {/* ── Stroke count ── */}
          <span className="text-[10px] shrink-0 tabular-nums" style={{ color: uiSub, fontFamily: 'Outfit, sans-serif' }}>
            {strokes.length} traço{strokes.length !== 1 ? 's' : ''}
          </span>

          <div className="shrink-0" style={{ width: 1, height: 22, background: uiBorder }} />

          {/* ── Background picker ── */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setShowBgPicker((v) => !v); setShowColorPicker(false); setShowWidthPicker(false) }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:opacity-80 transition-opacity"
              style={{ background: dm ? '#2e2820' : '#fff', border: `1.5px solid ${uiBorder}` }}
              title="Fundo"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: uiSub }}>
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
              </svg>
              <span className="text-xs font-semibold" style={{ color: uiText, fontFamily: 'Outfit, sans-serif' }}>{BG_LABELS[bg]}</span>
            </button>
            {showBgPicker && (
              <div className="absolute mt-1 z-50 rounded-2xl p-3 shadow-2xl"
                style={{ top: '100%', right: 0, background: dm ? '#252018' : '#fff', border: `1px solid ${uiBorder}`, width: 180 }}>
                <p className="text-[10px] font-bold mb-2" style={{ color: uiSub }}>Fundo do quadro</p>
                <div className="space-y-1">
                  {(Object.keys(BG_LABELS) as BgMode[]).map((m) => (
                    <button key={m} onClick={() => { setBg(m); setShowBgPicker(false) }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-black/5 transition-colors"
                      style={{ background: bg === m ? accent + '18' : 'transparent' }}>
                      <span style={{ fontSize: 13 }}>
                        {m === 'white' ? '⬜' : m === 'dark' ? '⬛' : m === 'grid' ? '⊞' : m === 'dots' ? '⠿' : '≡'}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: bg === m ? accent : uiText, fontFamily: 'Outfit, sans-serif' }}>
                        {BG_LABELS[m]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Canvas container */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          onClick={() => { setShowColorPicker(false); setShowWidthPicker(false); setShowBgPicker(false) }}
        >
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            style={{ display: 'block', cursor, touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />

          {/* Text input overlay */}
          {textInput && (
            <div style={{ position: 'absolute', left: textInput.x, top: textInput.y, zIndex: 10 }}>
              <input
                autoFocus
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setTextInput(null) }}
                onBlur={commitText}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: '1.5px dashed rgba(0,0,0,0.25)',
                  color,
                  fontSize: textSize,
                  fontFamily: 'Outfit, sans-serif',
                  minWidth: 80,
                  caretColor: color,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
