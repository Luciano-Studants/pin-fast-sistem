// SpreadsheetEditor — Google Sheets-like spreadsheet editor
import { toPng, toSvg } from 'html-to-image'
import jsPDF from 'jspdf'
import { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react'
import type { Spreadsheet, SpreadsheetCell } from '../types'
import type { BoardExportFn } from './Board'

const COLS = 26
const ROWS = 100
const DEFAULT_COL_W = 110
const ROW_H = 26
const HEAD_W = 48
const HEAD_H = 26

type Cells = Record<string, SpreadsheetCell>

// ── Address helpers ──────────────────────────────────────────────────────────
function colLetter(i: number) { return String.fromCharCode(65 + i) }
function cellKey(col: number, row: number) { return `${colLetter(col)}${row + 1}` }
function parseKey(key: string): { col: number; row: number } {
  const m = key.match(/^([A-Z]+)(\d+)$/)
  if (!m) return { col: 0, row: 0 }
  const col = m[1].split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1
  return { col, row: parseInt(m[2]) - 1 }
}

// ── Formula evaluator ────────────────────────────────────────────────────────
function getVal(key: string, cells: Cells, depth: number): number | string {
  if (depth > 32) return '#REF!'
  const cell = cells[key.toUpperCase()]
  if (!cell || cell.v === '') return 0
  const ev = evalCell(cell.v, cells, depth + 1)
  const n = parseFloat(ev)
  return isNaN(n) ? ev : n
}

function rangeVals(range: string, cells: Cells, depth: number): (number | string)[] {
  const [s, e] = range.split(':')
  const { col: sc, row: sr } = parseKey(s)
  const { col: ec, row: er } = parseKey(e)
  const out: (number | string)[] = []
  for (let r = Math.min(sr, er); r <= Math.max(sr, er); r++)
    for (let c = Math.min(sc, ec); c <= Math.max(sc, ec); c++)
      out.push(getVal(cellKey(c, r), cells, depth))
  return out
}

type Tok = { t: 'num' | 'str' | 'cell' | 'range' | 'op' | 'lp' | 'rp' | 'comma' | 'name'; v: string }

function tokenize(s: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (/\s/.test(ch)) { i++; continue }
    if (ch === '"') {
      let v = ''; i++
      while (i < s.length && s[i] !== '"') v += s[i++]
      i++; toks.push({ t: 'str', v }); continue
    }
    if (/[0-9.]/.test(ch)) {
      let v = ''
      while (i < s.length && /[0-9.]/.test(s[i])) v += s[i++]
      toks.push({ t: 'num', v }); continue
    }
    if (/[A-Za-z]/.test(ch)) {
      let v = ''
      while (i < s.length && /[A-Za-z0-9]/.test(s[i])) v += s[i++]
      const up = v.toUpperCase()
      if (/^[A-Z]+[0-9]+$/.test(up) && s[i] === ':') {
        i++
        let e = ''
        while (i < s.length && /[A-Za-z0-9]/.test(s[i])) e += s[i++]
        toks.push({ t: 'range', v: `${up}:${e.toUpperCase()}` })
      } else if (/^[A-Z]+[0-9]+$/.test(up)) {
        toks.push({ t: 'cell', v: up })
      } else {
        toks.push({ t: 'name', v: up })
      }
      continue
    }
    if (/[+\-*\/^<>=&]/.test(ch)) { toks.push({ t: 'op', v: ch }); i++; continue }
    if (ch === '(') { toks.push({ t: 'lp', v: '(' }); i++; continue }
    if (ch === ')') { toks.push({ t: 'rp', v: ')' }); i++; continue }
    if (ch === ',') { toks.push({ t: 'comma', v: ',' }); i++; continue }
    i++
  }
  return toks
}

function callFn(name: string, args: (number | string | (number | string)[])[]): number | string {
  const flat = args.flat()
  const nums = flat.map(v => typeof v === 'string' ? parseFloat(v) : v).filter(v => !isNaN(v as number)) as number[]
  switch (name) {
    case 'SUM': return nums.reduce((a, b) => a + b, 0)
    case 'AVERAGE': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
    case 'COUNT': return nums.length
    case 'COUNTA': return flat.filter(v => v !== '' && v !== 0).length
    case 'MIN': return nums.length ? Math.min(...nums) : 0
    case 'MAX': return nums.length ? Math.max(...nums) : 0
    case 'ABS': return Math.abs(nums[0] ?? 0)
    case 'ROUND': return Math.round((nums[0] ?? 0) * 10 ** (nums[1] ?? 0)) / 10 ** (nums[1] ?? 0)
    case 'CEIL': return Math.ceil(nums[0] ?? 0)
    case 'FLOOR': return Math.floor(nums[0] ?? 0)
    case 'SQRT': return Math.sqrt(Math.abs(nums[0] ?? 0))
    case 'POWER': return (nums[0] ?? 0) ** (nums[1] ?? 2)
    case 'IF': { const cond = Array.isArray(args[0]) ? args[0][0] : args[0]; return (cond && cond !== 0 && cond !== '') ? (Array.isArray(args[1]) ? args[1][0] : (args[1] ?? 0)) : (Array.isArray(args[2]) ? args[2][0] : (args[2] ?? 0)) }
    case 'CONCAT': case 'CONCATENATE': return flat.map(String).join('')
    case 'LEN': return String(flat[0] ?? '').length
    case 'UPPER': return String(flat[0] ?? '').toUpperCase()
    case 'LOWER': return String(flat[0] ?? '').toLowerCase()
    case 'TRIM': return String(flat[0] ?? '').trim()
    case 'LEFT': return String(flat[0] ?? '').slice(0, nums[1] ?? 1)
    case 'RIGHT': { const s = String(flat[0] ?? ''); return s.slice(s.length - (nums[1] ?? 1)) }
    case 'TODAY': return new Date().toLocaleDateString('pt-BR')
    case 'NOW': return new Date().toLocaleString('pt-BR')
    default: return `#NAME?`
  }
}

function parseExprFrom(toks: Tok[], cells: Cells, depth: number): [number | string, number] {
  let pos = 0

  function peek() { return toks[pos] }
  function consume() { return toks[pos++] }

  function expr(): number | string {
    let left = term()
    while (peek()?.t === 'op' && (peek().v === '+' || peek().v === '-' || peek().v === '&')) {
      const op = consume().v
      const right = term()
      if (op === '&') { left = String(left) + String(right); continue }
      const l = +left, r = +right
      left = op === '+' ? l + r : l - r
    }
    return left
  }

  function term(): number | string {
    let left = factor()
    while (peek()?.t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = consume().v
      const right = factor()
      const l = +left, r = +right
      left = op === '*' ? l * r : r === 0 ? Infinity : l / r
    }
    return left
  }

  function factor(): number | string {
    const t = peek()
    if (!t) return 0
    if (t.t === 'op' && t.v === '-') { consume(); return -(factor() as number) }
    if (t.t === 'num') { consume(); return parseFloat(t.v) }
    if (t.t === 'str') { consume(); return t.v }
    if (t.t === 'cell') { consume(); return getVal(t.v, cells, depth) }
    if (t.t === 'lp') {
      consume()
      const v = expr()
      if (peek()?.t === 'rp') consume()
      return v
    }
    if (t.t === 'name') {
      consume()
      if (peek()?.t !== 'lp') return 0
      consume()
      const args: (number | string | (number | string)[])[] = []
      while (peek() && peek()?.t !== 'rp') {
        if (peek()?.t === 'range') { args.push(rangeVals(consume().v, cells, depth)) }
        else args.push(expr())
        if (peek()?.t === 'comma') consume()
      }
      if (peek()?.t === 'rp') consume()
      return callFn(t.v, args)
    }
    consume(); return 0
  }

  const result = expr()
  return [result, pos]
}

function evalCell(raw: string, cells: Cells, depth = 0): string {
  if (!raw.startsWith('=')) return raw
  try {
    const toks = tokenize(raw.slice(1).trim().toUpperCase())
    const [result] = parseExprFrom(toks, cells, depth)
    if (typeof result === 'number') return isFinite(result) ? String(result) : '#DIV/0!'
    return String(result)
  } catch { return '#ERR!' }
}

function formatDisplay(raw: string, computed: string, fmt?: SpreadsheetCell['fmt']): string {
  const n = parseFloat(computed)
  if (!isNaN(n)) {
    if (fmt === 'currency') return `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
    if (fmt === 'percent') return `${(n * 100).toFixed(1)}%`
    if (fmt === 'number') return n.toLocaleString('pt-BR', { maximumFractionDigits: 10 })
  }
  return computed
}

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  sheet: Spreadsheet
  onUpdate: (id: string, title: string, cells: Cells, colWidths: Record<number, number>) => void
  darkMode: boolean
  exportRef: React.MutableRefObject<BoardExportFn | null>
}

// ── Component ────────────────────────────────────────────────────────────────
export default function SpreadsheetEditor({ sheet, onUpdate, darkMode, exportRef }: Props) {
  const dk = darkMode
  const [title, setTitle] = useState(sheet.title)
  const [cells, setCells] = useState<Cells>(sheet.cells || {})
  const [colWidths, setColWidths] = useState<Record<number, number>>(sheet.colWidths || {})
  const [sel, setSel] = useState({ col: 0, row: 0 })
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const [fmtColorOpen, setFmtColorOpen] = useState<'text' | 'bg' | null>(null)
  const [colorAnchor, setColorAnchor] = useState({ x: 0, y: 0 })

  const gridRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const formulaRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Virtual scrolling state
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(600)
  const ROW_BUFFER = 8
  const visStart = Math.max(0, Math.floor(scrollTop / ROW_H) - ROW_BUFFER)
  const visEnd = Math.min(ROWS, Math.ceil((scrollTop + viewportH) / ROW_H) + ROW_BUFFER)
  const padTop = visStart * ROW_H
  const padBottom = (ROWS - visEnd) * ROW_H

  const selKey = cellKey(sel.col, sel.row)
  const currentCell = cells[selKey]

  // Computed values
  const computed = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const k of Object.keys(cells)) {
      out[k] = evalCell(cells[k].v || '', cells)
    }
    return out
  }, [cells])

  const getDisplay = (key: string) => {
    const cell = cells[key]
    if (!cell || cell.v === '') return ''
    const cv = computed[key] ?? evalCell(cell.v, cells)
    return formatDisplay(cell.v, cv, cell.fmt)
  }

  const save = useCallback((c: Cells, cw: Record<number, number>, t = title) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => onUpdate(sheet.id, t, c, cw), 500)
  }, [sheet.id, title, onUpdate])

  const commitEdit = useCallback((val: string, nextSel?: typeof sel) => {
    setEditing(false)
    const key = cellKey(sel.col, sel.row)
    let updated: Cells
    if (val.trim() === '') {
      const { [key]: _, ...rest } = cells
      updated = rest
    } else {
      updated = { ...cells, [key]: { ...(cells[key] || {}), v: val } }
    }
    setCells(updated)
    save(updated, colWidths)
    if (nextSel) setSel(nextSel)
  }, [sel, cells, colWidths, save])

  const startEdit = useCallback((initial?: string) => {
    const val = initial !== undefined ? initial : (cells[selKey]?.v || '')
    setEditVal(val)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [selKey, cells])

  const clampSel = (col: number, row: number) => ({
    col: Math.max(0, Math.min(COLS - 1, col)),
    row: Math.max(0, Math.min(ROWS - 1, row)),
  })

  const move = useCallback((dc: number, dr: number) => {
    setSel(p => clampSel(p.col + dc, p.row + dr))
  }, [])

  // Grid keyboard
  const onGridKey = useCallback((e: React.KeyboardEvent) => {
    if (editing) return
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); move(0, -1); break
      case 'ArrowDown': e.preventDefault(); move(0, 1); break
      case 'ArrowLeft': e.preventDefault(); move(-1, 0); break
      case 'ArrowRight': e.preventDefault(); move(1, 0); break
      case 'Tab': e.preventDefault(); move(1, 0); break
      case 'Enter': e.preventDefault(); startEdit(); break
      case 'F2': e.preventDefault(); startEdit(); break
      case 'Delete': case 'Backspace': {
        e.preventDefault()
        const { [selKey]: _, ...rest } = cells
        setCells(rest); save(rest, colWidths); break
      }
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) startEdit(e.key)
    }
  }, [editing, move, startEdit, selKey, cells, colWidths, save])

  // Cell input keyboard
  const onCellKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(editVal, clampSel(sel.col, sel.row + 1)) }
    else if (e.key === 'Tab') { e.preventDefault(); commitEdit(editVal, clampSel(sel.col + 1, sel.row)) }
    else if (e.key === 'Escape') { setEditing(false); gridRef.current?.focus() }
  }, [editVal, commitEdit, sel])

  const applyStyle = useCallback((style: Partial<SpreadsheetCell>) => {
    const updated = { ...cells, [selKey]: { ...cells[selKey], v: cells[selKey]?.v || '', ...style } }
    setCells(updated); save(updated, colWidths)
  }, [cells, selKey, colWidths, save])

  const colW = (c: number) => colWidths[c] ?? DEFAULT_COL_W

  // CSV export helper
  const exportCSV = () => {
    let csv = ''
    for (let r = 0; r < ROWS; r++) {
      const row: string[] = []
      let hasData = false
      for (let c = 0; c < COLS; c++) {
        const k = cellKey(c, r)
        const v = getDisplay(k)
        if (v) hasData = true
        row.push(v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v)
      }
      if (!hasData) break
      csv += row.join(',') + '\n'
    }
    const a = document.createElement('a')
    a.download = `${title.trim() || 'planilha'}.csv`
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.click()
  }

  // Register export
  useEffect(() => {
    if (!exportRef) return
    const sheetExport: BoardExportFn = async (format) => {
      const el = gridRef.current
      if (!el) return
      const name = title.trim() || 'planilha'

      // Temporarily remove selection highlight for clean export
      el.setAttribute('data-exporting', 'true')
      await new Promise<void>(r => requestAnimationFrame(() => r()))

      try {
        if (format === 'svg') {
          const url = await toSvg(el)
          const a = document.createElement('a'); a.download = `${name}.svg`; a.href = url; a.click()
        } else {
          const url = await toPng(el, { pixelRatio: 2 })
          if (format === 'png') {
            const a = document.createElement('a'); a.download = `${name}.png`; a.href = url; a.click()
          } else {
            const w = el.offsetWidth, h = el.offsetHeight
            const A4W = 794, A4H = 1123
            const scale = A4W / w
            const scaledH = h * scale
            const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [A4W, A4H] })
            let y = 0, p = 0
            while (y < scaledH) {
              if (p > 0) pdf.addPage()
              pdf.addImage(url, 'PNG', 0, -y, A4W, scaledH)
              y += A4H; p++
            }
            pdf.save(`${name}.pdf`)
          }
        }
      } finally {
        el.removeAttribute('data-exporting')
      }
    }
    exportRef.current = sheetExport
    return () => { if (exportRef) exportRef.current = null }
  }, [exportRef, title])

  // Cleanup
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  // Track grid viewport size for virtual scrolling
  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
    ro.observe(el)
    setViewportH(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  // Colors
  const bg = dk ? '#0f0d0b' : '#ffffff'
  const headerBg = dk ? '#1a1612' : '#f8f7f4'
  const headerTxt = dk ? '#7a6858' : '#9a7a5a'
  const borderColor = dk ? '#2a2420' : '#ddd'
  const selBorder = '#4285f4'
  const selFill = 'rgba(66,133,244,0.10)'
  const textColor = dk ? '#f0e6d3' : '#1a1a1a'
  const tbBg = dk ? '#1a1612' : '#faf7f2'
  const tbBorder = dk ? '#2e2820' : '#e8d5b7'
  const activeCellBg = dk ? '#ffffff' : '#ffffff'

  const cell = currentCell
  const isBold = cell?.bold
  const isItalic = cell?.italic
  const align = cell?.align || 'left'
  const cellFmt = cell?.fmt || 'text'

  const CELL_COLORS = ['#1a0f00','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#ffffff']
  const BG_COLORS = ['transparent','#fef9c3','#fca5a5','#93c5fd','#86efac','#fdba74','#c4b5fd','#f9a8d4','#d1d5db']

  const cols = Array.from({ length: COLS }, (_, i) => i)
  const rows = Array.from({ length: ROWS }, (_, i) => i)

  function TBtn({ active, onClick, title: t, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
    return (
      <button onMouseDown={e => { e.preventDefault(); onClick() }} title={t}
        className="flex items-center justify-center h-7 px-1.5 rounded-lg transition-all shrink-0 text-xs"
        style={{
          background: active ? 'rgba(224,123,57,0.18)' : 'transparent',
          color: active ? '#e07b39' : (dk ? '#c4a880' : '#5a3e28'),
          border: active ? '1px solid rgba(224,123,57,0.3)' : '1px solid transparent',
          fontFamily: 'Nunito, sans-serif',
        }}>
        {children}
      </button>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: bg }}>
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-1 px-2 sm:px-3 py-1.5 flex-nowrap overflow-x-auto"
        style={{ background: tbBg, borderBottom: `1px solid ${tbBorder}`, minHeight: 44 }}>

        {/* Cell address */}
        <div className="flex items-center justify-center rounded-lg px-2 h-7 text-xs font-bold shrink-0"
          style={{ background: dk ? '#2e2820' : '#f0e6d3', color: headerTxt, fontFamily: 'Outfit, sans-serif', minWidth: 48 }}>
          {selKey}
        </div>

        {/* Formula bar */}
        <input ref={formulaRef}
          value={editing ? editVal : (currentCell?.v || '')}
          onChange={e => { if (!editing) { startEdit(e.target.value) } else setEditVal(e.target.value) }}
          onKeyDown={e => { if (editing) onCellKey(e) }}
          placeholder="Valor ou =fórmula…"
          className="w-36 sm:w-52 h-7 rounded-lg px-2 text-xs outline-none shrink-0"
          style={{ background: dk ? '#161210' : '#fff', border: `1px solid ${tbBorder}`, color: textColor, fontFamily: 'Outfit, sans-serif' }}
        />

        <div style={{ width: 1, height: 20, background: tbBorder, margin: '0 2px', flexShrink: 0 }} />

        {/* Bold */}
        <TBtn active={isBold} onClick={() => applyStyle({ bold: !isBold })} title="Negrito">
          <span style={{ fontWeight: 900, fontSize: 13 }}>B</span>
        </TBtn>
        {/* Italic */}
        <TBtn active={isItalic} onClick={() => applyStyle({ italic: !isItalic })} title="Itálico">
          <span style={{ fontStyle: 'italic', fontSize: 13 }}>I</span>
        </TBtn>

        <div style={{ width: 1, height: 20, background: tbBorder, margin: '0 2px', flexShrink: 0 }} />

        {/* Align */}
        {(['left', 'center', 'right'] as const).map((a, i) => {
          const svgs = [
            <svg key="l" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>,
            <svg key="c" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>,
            <svg key="r" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>,
          ]
          return <TBtn key={a} active={align === a} onClick={() => applyStyle({ align: a })} title={['Esquerda','Centro','Direita'][i]}>{svgs[i]}</TBtn>
        })}

        <div style={{ width: 1, height: 20, background: tbBorder, margin: '0 2px', flexShrink: 0 }} />

        {/* Number formats */}
        <TBtn active={cellFmt === 'number'} onClick={() => applyStyle({ fmt: cellFmt === 'number' ? 'text' : 'number' })} title="Número">#</TBtn>
        <TBtn active={cellFmt === 'currency'} onClick={() => applyStyle({ fmt: cellFmt === 'currency' ? 'text' : 'currency' })} title="Moeda R$">R$</TBtn>
        <TBtn active={cellFmt === 'percent'} onClick={() => applyStyle({ fmt: cellFmt === 'percent' ? 'text' : 'percent' })} title="Porcentagem">%</TBtn>

        <div style={{ width: 1, height: 20, background: tbBorder, margin: '0 2px', flexShrink: 0 }} />

        {/* Text color */}
        <div className="relative shrink-0">
          <button onMouseDown={e => {
            e.preventDefault()
            const r = e.currentTarget.getBoundingClientRect()
            setColorAnchor({ x: r.left, y: r.bottom + 4 })
            setFmtColorOpen(v => v === 'text' ? null : 'text')
          }} title="Cor do texto"
            className="flex flex-col items-center justify-center w-7 h-7 rounded-lg hover:bg-black/5 transition-all gap-0.5">
            <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'Nunito, sans-serif', color: cell?.color || (dk ? '#f0e6d3' : '#1a0f00'), lineHeight: 1 }}>A</span>
            <div style={{ width: 14, height: 3, borderRadius: 2, background: cell?.color || '#1a0f00' }} />
          </button>
        </div>

        {/* Background color */}
        <div className="relative shrink-0">
          <button onMouseDown={e => {
            e.preventDefault()
            const r = e.currentTarget.getBoundingClientRect()
            setColorAnchor({ x: r.left, y: r.bottom + 4 })
            setFmtColorOpen(v => v === 'bg' ? null : 'bg')
          }} title="Cor de fundo"
            className="flex flex-col items-center justify-center w-7 h-7 rounded-lg hover:bg-black/5 transition-all gap-0.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={dk ? '#c4a880' : '#5a3e28'} strokeWidth="2" strokeLinecap="round">
              <path d="M11 2L2 11l9 9 9-9-9-9z"/><path d="M2 11h20"/>
            </svg>
            <div style={{ width: 14, height: 3, borderRadius: 2, background: cell?.bg || 'transparent', border: '1px solid rgba(0,0,0,0.15)' }} />
          </button>
        </div>

        <div style={{ width: 1, height: 20, background: tbBorder, margin: '0 2px', flexShrink: 0 }} />

        {/* Clear cell */}
        <button onMouseDown={e => {
          e.preventDefault()
          const { [selKey]: _, ...rest } = cells
          setCells(rest); save(rest, colWidths)
        }} title="Limpar célula"
          className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:bg-red-50/50 shrink-0"
          style={{ color: '#ef4444' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>

        {/* CSV download */}
        <button onMouseDown={e => { e.preventDefault(); exportCSV() }}
          title="Baixar como CSV"
          className="flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-semibold transition-all hover:bg-black/5 shrink-0"
          style={{ color: dk ? '#7a6858' : '#9a7a5a', fontFamily: 'Outfit, sans-serif', border: `1px solid ${tbBorder}` }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          CSV
        </button>

        <div className="flex-1" />

        {/* Sheet title */}
        <input value={title}
          onChange={e => { setTitle(e.target.value); save(cells, colWidths, e.target.value) }}
          className="h-7 rounded-lg px-2 text-xs font-bold outline-none bg-transparent text-right shrink-0"
          style={{ color: dk ? '#c4a880' : '#5a3e28', fontFamily: 'Nunito, sans-serif', minWidth: 120 }}
        />
      </div>

      {/* Color picker portal */}
      {fmtColorOpen && (
        <div
          style={{ position: 'fixed', top: colorAnchor.y, left: colorAnchor.x, zIndex: 9999, padding: 8, borderRadius: 12, background: dk ? '#1e1a16' : '#fff', border: `1px solid ${tbBorder}`, boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="grid grid-cols-9 gap-1">
            {(fmtColorOpen === 'text' ? CELL_COLORS : BG_COLORS).map(c => (
              <button key={c} onMouseDown={e => {
                e.preventDefault()
                applyStyle(fmtColorOpen === 'text' ? { color: c } : { bg: c === 'transparent' ? undefined : c })
                setFmtColorOpen(null)
              }}
                className="w-5 h-5 rounded hover:scale-110 transition-transform"
                style={{ background: c === 'transparent' ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 8px 8px' : c, border: '1.5px solid rgba(0,0,0,0.12)' }} />
            ))}
          </div>
        </div>
      )}

      {/* Click-away to close color picker */}
      {fmtColorOpen && <div className="fixed inset-0 z-[9998]" onMouseDown={() => setFmtColorOpen(null)} />}

      {/* Grid */}
      <div
        ref={gridRef}
        className="flex-1 overflow-auto outline-none"
        tabIndex={0}
        onKeyDown={onGridKey}
        onScroll={(e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}
        style={{ background: bg }}
      >
        <div style={{ display: 'inline-block', minWidth: '100%' }}>
          {/* Column headers — sticky top */}
          <div className="flex" style={{ position: 'sticky', top: 0, zIndex: 20, background: headerBg }}>
            <div style={{ width: HEAD_W, minWidth: HEAD_W, height: HEAD_H, flexShrink: 0, borderRight: `1px solid ${borderColor}`, borderBottom: `2px solid ${borderColor}`, background: headerBg }} />
            {cols.map(ci => (
              <div key={ci} style={{
                width: colW(ci), minWidth: colW(ci), height: HEAD_H, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRight: `1px solid ${borderColor}`, borderBottom: `2px solid ${borderColor}`,
                fontSize: 11, fontWeight: 600, fontFamily: 'Outfit, sans-serif',
                color: sel.col === ci ? selBorder : headerTxt,
                background: sel.col === ci ? 'rgba(66,133,244,0.07)' : headerBg,
                userSelect: 'none', cursor: 'default',
              }}>
                {colLetter(ci)}
              </div>
            ))}
          </div>

          {/* Virtual spacer top */}
          {padTop > 0 && <div style={{ height: padTop }} />}

          {/* Only render visible rows */}
          {rows.slice(visStart, visEnd).map(ri => (
            <div key={ri} className="flex" style={{ height: ROW_H }}>
              {/* Row number — sticky left */}
              <div style={{
                width: HEAD_W, minWidth: HEAD_W, height: ROW_H, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRight: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`,
                fontSize: 11, fontWeight: 600, fontFamily: 'Outfit, sans-serif',
                color: sel.row === ri ? selBorder : headerTxt,
                background: sel.row === ri ? 'rgba(66,133,244,0.07)' : headerBg,
                position: 'sticky', left: 0, zIndex: 10, userSelect: 'none', cursor: 'default',
              }}>
                {ri + 1}
              </div>

              {/* Cells */}
              {cols.map(ci => {
                const key = cellKey(ci, ri)
                const cell = cells[key]
                const isSelected = sel.col === ci && sel.row === ri
                const isEditingThis = isSelected && editing
                const dv = getDisplay(key)

                return (
                  <div key={key} style={{
                    width: colW(ci), minWidth: colW(ci), height: ROW_H, flexShrink: 0,
                    position: 'relative',
                    borderRight: `1px solid ${borderColor}`,
                    borderBottom: `1px solid ${borderColor}`,
                    background: isSelected ? selFill : (cell?.bg || bg),
                    outline: isSelected ? `2px solid ${selBorder}` : 'none',
                    outlineOffset: -1,
                    zIndex: isSelected ? 2 : 1,
                  }}
                    onClick={() => {
                      if (editing) commitEdit(editVal)
                      setSel({ col: ci, row: ri })
                      setEditing(false)
                      setTimeout(() => gridRef.current?.focus(), 0)
                    }}
                    onDoubleClick={() => { setSel({ col: ci, row: ri }); startEdit() }}
                  >
                    {isEditingThis ? (
                      <input ref={inputRef}
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={onCellKey}
                        onBlur={() => commitEdit(editVal)}
                        style={{
                          position: 'absolute', inset: 0, width: '100%', height: '100%',
                          padding: '0 6px', border: 'none', outline: `2px solid ${selBorder}`,
                          background: activeCellBg, color: '#1a1a1a',
                          fontSize: 12, fontFamily: 'Outfit, sans-serif', zIndex: 10,
                        }}
                      />
                    ) : (
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center',
                        padding: '0 6px',
                        fontSize: 12, fontFamily: 'Outfit, sans-serif',
                        fontWeight: cell?.bold ? 700 : 400,
                        fontStyle: cell?.italic ? 'italic' : 'normal',
                        color: cell?.color || textColor,
                        justifyContent: cell?.align === 'center' ? 'center' : cell?.align === 'right' ? 'flex-end' : 'flex-start',
                        overflow: 'hidden', whiteSpace: 'nowrap',
                        userSelect: 'none',
                      }}>
                        {dv}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Virtual spacer bottom */}
          {padBottom > 0 && <div style={{ height: padBottom }} />}
        </div>
      </div>
    </div>
  )
}
