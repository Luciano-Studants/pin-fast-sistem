// TextEditor — rich text document editor
import { toPng, toSvg } from 'html-to-image'
import jsPDF from 'jspdf'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { TextAlign } from '@tiptap/extension-text-align'
import { Highlight } from '@tiptap/extension-highlight'
import { TextStyle, Color, FontFamily } from '@tiptap/extension-text-style'
import { Typography } from '@tiptap/extension-typography'
import { CharacterCount } from '@tiptap/extension-character-count'
import { Placeholder } from '@tiptap/extension-placeholder'
import { useEffect, useState, useRef } from 'react'
import type { TextDocument } from '../types'
import type { BoardExportFn } from './Board'

interface Props {
  doc: TextDocument
  onUpdate: (id: string, title: string, content: string) => void
  onClose: () => void
  darkMode: boolean
  exportRef: React.MutableRefObject<BoardExportFn | null>
}

const FONTS = [
  { label: 'Outfit', value: 'Outfit, sans-serif' },
  { label: 'Nunito', value: 'Nunito, sans-serif' },
  { label: 'Kalam', value: 'Kalam, cursive' },
  { label: 'Monospace', value: 'monospace' },
]

const HEADING_OPTIONS = [
  { label: 'Normal', value: 0 },
  { label: 'Título 1', value: 1 },
  { label: 'Título 2', value: 2 },
  { label: 'Título 3', value: 3 },
]

const TEXT_COLORS = [
  '#1a0f00', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
]

const HIGHLIGHT_COLORS = [
  '#fef9c3', '#fca5a5', '#93c5fd', '#86efac',
  '#fdba74', '#c4b5fd', '#f9a8d4', '#d1d5db',
]

// Dropdown that renders via fixed positioning to escape overflow:hidden parents
function FixedDropdown({
  anchorRef,
  open,
  children,
  minWidth = 120,
  surface,
  border,
}: {
  anchorRef: React.RefObject<HTMLElement | null>
  open: boolean
  children: React.ReactNode
  minWidth?: number
  surface: string
  border: string
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (open && anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
  }, [open, anchorRef])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        minWidth,
        background: surface,
        border: `1px solid ${border}`,
        boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
        borderRadius: 12,
        overflow: 'hidden',
        animation: 'popIn 0.12s ease',
      }}
    >
      {children}
    </div>
  )
}

function ToolbarBtn({
  active, onClick, title, children, disabled, btnRef,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
  disabled?: boolean
  btnRef?: React.RefObject<HTMLButtonElement | null>
}) {
  return (
    <button
      ref={btnRef as React.RefObject<HTMLButtonElement>}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      disabled={disabled}
      className="flex items-center justify-center w-7 h-7 rounded-lg transition-all shrink-0"
      style={{
        background: active ? 'rgba(224,123,57,0.18)' : 'transparent',
        color: active ? '#e07b39' : '#5a3e28',
        border: active ? '1px solid rgba(224,123,57,0.3)' : '1px solid transparent',
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: '#e8d5b7', margin: '0 2px', flexShrink: 0 }} />
}

export default function TextEditor({ doc, onUpdate, onClose, darkMode, exportRef }: Props) {
  const dk = darkMode
  const paperRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState(doc.title)
  const [colorPickerOpen, setColorPickerOpen] = useState<'text' | 'highlight' | null>(null)
  const [fontOpen, setFontOpen] = useState(false)
  const [headingOpen, setHeadingOpen] = useState(false)
  const [saved, setSaved] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs for fixed-position dropdown anchors
  const headingBtnRef = useRef<HTMLButtonElement>(null)
  const fontBtnRef = useRef<HTMLButtonElement>(null)
  const colorBtnRef = useRef<HTMLButtonElement>(null)
  const highlightBtnRef = useRef<HTMLButtonElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      FontFamily,
      Typography,
      CharacterCount,
      Placeholder.configure({ placeholder: 'Comece a escrever o seu texto aqui…' }),
    ],
    content: doc.content || '<p></p>',
    onUpdate: ({ editor }) => {
      setSaved(false)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        if (editor.isDestroyed) return
        onUpdate(doc.id, title, editor.getHTML())
        setSaved(true)
      }, 800)
    },
  })

  // Sync title saves
  useEffect(() => {
    if (!editor) return
    setSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (!editor || editor.isDestroyed) return
      onUpdate(doc.id, title, editor.getHTML())
      setSaved(true)
    }, 600)
  }, [title])

  // Cleanup
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  // Close all dropdowns on click outside
  useEffect(() => {
    const close = () => { setHeadingOpen(false); setFontOpen(false); setColorPickerOpen(null) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])

  // Register document export into the shared exportRef
  useEffect(() => {
    if (!exportRef) return

    const docExport: BoardExportFn = async (format) => {
      const paper = paperRef.current
      if (!paper) return

      const name = title.trim() || 'documento'
      const PAPER_W = 760

      // Clone the paper into a fixed off-screen container with no overflow clipping
      const wrapper = document.createElement('div')
      wrapper.style.cssText = `
        position: fixed;
        top: 0;
        left: -9999px;
        width: ${PAPER_W}px;
        background: transparent;
        pointer-events: none;
        z-index: -1;
      `
      const clone = paper.cloneNode(true) as HTMLElement
      clone.style.cssText = `
        width: ${PAPER_W}px;
        max-width: ${PAPER_W}px;
        overflow: visible;
        border-radius: 16px;
        background: ${paper.style.background || '#fff'};
        box-shadow: none;
      `
      wrapper.appendChild(clone)
      document.body.appendChild(wrapper)

      // Let the browser lay out the clone
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

      const fullW = clone.scrollWidth
      const fullH = clone.scrollHeight

      try {
        if (format === 'svg') {
          const url = await toSvg(clone, { width: fullW, height: fullH })
          const a = document.createElement('a')
          a.download = `${name}.svg`
          a.href = url
          a.click()
        } else {
          const url = await toPng(clone, { pixelRatio: 2, width: fullW, height: fullH })

          if (format === 'png') {
            const a = document.createElement('a')
            a.download = `${name}.png`
            a.href = url
            a.click()
          } else {
            // PDF: paginate across A4 sheets
            const A4_W_PX = 794
            const A4_H_PX = 1123
            const scale = A4_W_PX / fullW
            const scaledH = fullH * scale

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [A4_W_PX, A4_H_PX] })

            let yOffset = 0
            let pageIndex = 0
            while (yOffset < scaledH) {
              if (pageIndex > 0) pdf.addPage()
              pdf.addImage(url, 'PNG', 0, -yOffset, A4_W_PX, scaledH)
              yOffset += A4_H_PX
              pageIndex++
            }

            pdf.save(`${name}.pdf`)
          }
        }
      } finally {
        document.body.removeChild(wrapper)
      }
    }

    if (exportRef) exportRef.current = docExport
    return () => { if (exportRef) exportRef.current = null }
  }, [exportRef, title])

  const currentFont = editor?.getAttributes('textStyle')?.fontFamily || FONTS[0].value
  const currentHeading = editor?.isActive('heading', { level: 1 }) ? 1
    : editor?.isActive('heading', { level: 2 }) ? 2
    : editor?.isActive('heading', { level: 3 }) ? 3 : 0
  const headingLabel = HEADING_OPTIONS.find(h => h.value === currentHeading)?.label || 'Normal'
  const fontLabel = FONTS.find(f => f.value === currentFont)?.label || 'Outfit'

  const wordCount = editor?.storage.characterCount?.words() ?? 0
  const charCount = editor?.storage.characterCount?.characters() ?? 0

  const bg = dk ? '#161210' : '#f0ebe3'
  const surface = dk ? '#1e1a16' : '#ffffff'
  const toolbarBg = dk ? '#1a1612' : '#faf7f2'
  const border = dk ? '#2e2820' : '#e8d5b7'
  const text = dk ? '#f0e6d3' : '#1a0f00'
  const muted = dk ? '#7a6858' : '#9a7a5a'

  const stopProp = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: bg }}>
      {/* Toolbar — no overflow:auto so dropdowns are not clipped */}
      <div
        className="shrink-0 flex items-center gap-0.5 px-2 sm:px-3 py-1.5 flex-nowrap overflow-x-auto"
        style={{
          background: toolbarBg,
          borderBottom: `1px solid ${border}`,
          minHeight: 44,
        }}
      >
        {/* Undo / Redo */}
        <ToolbarBtn title="Desfazer (Ctrl+Z)" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 2.83-6.36L3 9"/>
          </svg>
        </ToolbarBtn>
        <ToolbarBtn title="Refazer (Ctrl+Y)" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-2.83-6.36L21 9"/>
          </svg>
        </ToolbarBtn>

        <Sep />

        {/* Heading selector */}
        <div className="relative shrink-0">
          <button
            ref={headingBtnRef}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setHeadingOpen(v => !v); setFontOpen(false); setColorPickerOpen(null) }}
            className="flex items-center gap-1 px-2 h-7 rounded-lg text-xs font-semibold transition-all hover:bg-black/5"
            style={{ fontFamily: 'Outfit, sans-serif', color: muted, minWidth: 72 }}
          >
            {headingLabel}
            <span style={{ fontSize: 8, opacity: 0.5 }}>▼</span>
          </button>
          <FixedDropdown anchorRef={headingBtnRef} open={headingOpen} minWidth={128} surface={surface} border={border}>
            <div onMouseDown={stopProp}>
              {HEADING_OPTIONS.map(h => (
                <button key={h.value} onMouseDown={(e) => {
                  e.preventDefault()
                  if (h.value === 0) editor?.chain().focus().setParagraph().run()
                  else editor?.chain().focus().toggleHeading({ level: h.value as 1|2|3 }).run()
                  setHeadingOpen(false)
                }} className="w-full px-3 py-2 text-left text-sm hover:bg-black/5 transition-colors"
                  style={{
                    fontFamily: 'Nunito, sans-serif',
                    fontWeight: h.value === 0 ? 400 : 900 - h.value * 100,
                    fontSize: h.value === 0 ? 13 : 18 - h.value * 2,
                    color: text,
                    background: currentHeading === h.value ? 'rgba(224,123,57,0.1)' : 'transparent',
                  }}>
                  {h.label}
                </button>
              ))}
            </div>
          </FixedDropdown>
        </div>

        {/* Font family */}
        <div className="relative shrink-0">
          <button
            ref={fontBtnRef}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setFontOpen(v => !v); setHeadingOpen(false); setColorPickerOpen(null) }}
            className="flex items-center gap-1 px-2 h-7 rounded-lg text-xs font-semibold transition-all hover:bg-black/5"
            style={{ fontFamily: currentFont, color: muted, minWidth: 78 }}
          >
            {fontLabel}
            <span style={{ fontSize: 8, opacity: 0.5 }}>▼</span>
          </button>
          <FixedDropdown anchorRef={fontBtnRef} open={fontOpen} minWidth={148} surface={surface} border={border}>
            <div onMouseDown={stopProp}>
              {FONTS.map(f => (
                <button key={f.value} onMouseDown={(e) => {
                  e.preventDefault()
                  editor?.chain().focus().setFontFamily(f.value).run()
                  setFontOpen(false)
                }} className="w-full px-3 py-2 text-left text-sm hover:bg-black/5 transition-colors"
                  style={{ fontFamily: f.value, color: text, background: currentFont === f.value ? 'rgba(224,123,57,0.1)' : 'transparent' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </FixedDropdown>
        </div>

        <Sep />

        {/* Bold / Italic / Underline / Strike */}
        <ToolbarBtn title="Negrito (Ctrl+B)" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <span style={{ fontWeight: 900, fontSize: 13, fontFamily: 'Nunito, sans-serif' }}>B</span>
        </ToolbarBtn>
        <ToolbarBtn title="Itálico (Ctrl+I)" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <span style={{ fontStyle: 'italic', fontSize: 13, fontFamily: 'Nunito, sans-serif' }}>I</span>
        </ToolbarBtn>
        <ToolbarBtn title="Sublinhado (Ctrl+U)" active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <span style={{ textDecoration: 'underline', fontSize: 13, fontFamily: 'Nunito, sans-serif' }}>U</span>
        </ToolbarBtn>
        <ToolbarBtn title="Tachado" active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <span style={{ textDecoration: 'line-through', fontSize: 13, fontFamily: 'Nunito, sans-serif' }}>S</span>
        </ToolbarBtn>

        <Sep />

        {/* Text color */}
        <div className="relative shrink-0">
          <button
            ref={colorBtnRef}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setColorPickerOpen(v => v === 'text' ? null : 'text'); setFontOpen(false); setHeadingOpen(false) }}
            title="Cor do texto"
            className="flex flex-col items-center justify-center w-7 h-7 rounded-lg hover:bg-black/5 transition-all gap-0.5"
          >
            <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'Nunito, sans-serif', color: '#5a3e28', lineHeight: 1 }}>A</span>
            <div style={{ width: 14, height: 3, borderRadius: 2, background: editor?.getAttributes('textStyle').color || '#1a0f00' }} />
          </button>
          <FixedDropdown anchorRef={colorBtnRef} open={colorPickerOpen === 'text'} minWidth={120} surface={surface} border={border}>
            <div className="p-2" onMouseDown={stopProp}>
              <div className="grid grid-cols-4 gap-1">
                {TEXT_COLORS.map(c => (
                  <button key={c} onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().setColor(c).run(); setColorPickerOpen(null) }}
                    className="w-6 h-6 rounded-md hover:scale-110 transition-transform"
                    style={{ background: c, border: '1.5px solid rgba(0,0,0,0.1)' }} />
                ))}
              </div>
            </div>
          </FixedDropdown>
        </div>

        {/* Highlight */}
        <div className="relative shrink-0">
          <button
            ref={highlightBtnRef}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setColorPickerOpen(v => v === 'highlight' ? null : 'highlight'); setFontOpen(false); setHeadingOpen(false) }}
            title="Destaque"
            className="flex flex-col items-center justify-center w-7 h-7 rounded-lg hover:bg-black/5 transition-all gap-0.5"
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>🖊</span>
            <div style={{ width: 14, height: 3, borderRadius: 2, background: '#fef9c3' }} />
          </button>
          <FixedDropdown anchorRef={highlightBtnRef} open={colorPickerOpen === 'highlight'} minWidth={148} surface={surface} border={border}>
            <div className="p-2" onMouseDown={stopProp}>
              <div className="grid grid-cols-4 gap-1">
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c} onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().toggleHighlight({ color: c }).run(); setColorPickerOpen(null) }}
                    className="w-6 h-6 rounded-md hover:scale-110 transition-transform"
                    style={{ background: c, border: '1.5px solid rgba(0,0,0,0.1)' }} />
                ))}
                <button onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().unsetHighlight().run(); setColorPickerOpen(null) }}
                  className="w-6 h-6 rounded-md hover:scale-110 transition-transform flex items-center justify-center text-xs col-span-4"
                  style={{ background: 'transparent', border: `1px solid ${border}`, color: muted, fontFamily: 'Outfit, sans-serif' }}>
                  Remover
                </button>
              </div>
            </div>
          </FixedDropdown>
        </div>

        <Sep />

        {/* Alignment */}
        {(['left', 'center', 'right', 'justify'] as const).map((align, i) => {
          const icons = [
            <svg key="l" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>,
            <svg key="c" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>,
            <svg key="r" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>,
            <svg key="j" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
          ]
          const labels = ['Alinhar esquerda', 'Centralizar', 'Alinhar direita', 'Justificar']
          return (
            <ToolbarBtn key={align} title={labels[i]} active={editor?.isActive({ textAlign: align })}
              onClick={() => editor?.chain().focus().setTextAlign(align).run()}>
              {icons[i]}
            </ToolbarBtn>
          )
        })}

        <Sep />

        {/* Lists */}
        <ToolbarBtn title="Lista de marcadores" active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Lista numerada" active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">1.</text><text x="2" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">2.</text><text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">3.</text></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Citação" active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Bloco de código" active={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </ToolbarBtn>

        <Sep />

        {/* Horizontal rule */}
        <ToolbarBtn title="Linha horizontal" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="12" x2="22" y2="12"/></svg>
        </ToolbarBtn>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Word / char count + save indicator */}
        <div className="flex items-center gap-3 px-2 shrink-0">
          <span style={{ fontSize: 10, color: muted, fontFamily: 'Outfit, sans-serif' }}>
            {wordCount} pal. · {charCount} car.
          </span>
          <span
            className="flex items-center gap-1"
            style={{ fontSize: 10, color: saved ? '#22c55e' : '#f59e0b', fontFamily: 'Outfit, sans-serif' }}
          >
            {saved ? (
              <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Salvo</>
            ) : (
              <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Salvando…</>
            )}
          </span>
        </div>
      </div>

      {/* Document area — ref'd for export overflow trick */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-10 px-4" style={{ background: bg }}>
        <div
          ref={paperRef}
          className="mx-auto rounded-2xl overflow-hidden"
          style={{
            maxWidth: 760,
            background: surface,
            boxShadow: dk
              ? '0 4px 32px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.3)'
              : '0 4px 32px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          {/* Document title */}
          <div className="px-12 pt-10 pb-2" style={{ borderBottom: `1px solid ${border}` }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do documento"
              className="w-full bg-transparent outline-none text-3xl font-black"
              style={{ fontFamily: 'Nunito, sans-serif', color: text }}
            />
            <p style={{ fontSize: 11, color: muted, fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
              {new Date(doc.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Editor content */}
          <div className="px-12 py-8 tiptap-editor" style={{ color: text, fontFamily: 'Outfit, sans-serif' }}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  )
}
