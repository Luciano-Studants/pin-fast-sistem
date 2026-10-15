import { useState } from 'react'
import type { Note } from '../../types'
import { newId } from '../../lib/id'

const NOTE_COLORS = ['#fef9c3', '#86efac', '#93c5fd', '#fdba74', '#c4b5fd', '#f9a8d4', '#d1d5db']

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

interface Props {
  notes: Note[]
  onNotesChange: (notes: Note[]) => void
}

export default function NotesPanel({ notes, onNotesChange }: Props) {
  const [content, setContent] = useState('')
  const [color, setColor] = useState('#fef9c3')
  const [title, setTitle] = useState('')

  const addNote = () => {
    if (!content.trim()) return
    const note: Note = {
      id: newId(),
      title: title.trim() || undefined,
      content,
      color,
      createdAt: new Date().toISOString(),
    }
    onNotesChange([note, ...notes])
    setContent('')
    setTitle('')
  }

  return (
    <div className="size-full flex flex-col sm:flex-row overflow-hidden" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Compose area */}
      <div
        className="w-full sm:w-44 max-h-40 sm:max-h-none flex flex-col p-3 gap-2 shrink-0 border-b sm:border-b-0 sm:border-r overflow-auto"
        style={{ borderColor: '#e8d5b7', background: '#fffbf5' }}
      >
        <p
          className="text-xs font-bold"
          style={{ color: '#2d1a0a', fontFamily: 'Nunito, sans-serif' }}
        >
          Nova anotação
        </p>
        <input 
          placeholder="Título (opcional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
          style={{
            background: '#fff',
            border: '1.5px solid #e8d5b7',
            color: '#2d1a0a',
          }}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva algo..."
          className="flex-1 resize-none text-xs outline-none p-2 rounded-lg"
          style={{
            background: color,
            fontFamily: 'Kalam, cursive',
            color: '#1a0f00',
            border: 'none',
            minHeight: 60,
            lineHeight: 1.6,
          }}
        />
        <div className="flex gap-1.5 flex-wrap">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-4 h-4 rounded-full transition-transform hover:scale-110"
              style={{
                background: c,
                border: color === c ? '2px solid #2d1a0a' : '2px solid transparent',
                outline: color === c ? '1px solid #2d1a0a' : 'none',
                outlineOffset: 1,
              }}
            />
          ))}
        </div>
        <button
          onClick={addNote}
          disabled={!content.trim()}
          className="py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 disabled:opacity-40"
          style={{
            background: '#e07b39',
            color: '#fff',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          Adicionar
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-wrap content-start gap-2.5 p-3">
          {notes.length === 0 && (
            <div className="flex-1 flex items-center justify-center h-full">
              <p style={{ color: '#c4a47c', fontSize: 11 }}>Nenhuma anotação ainda.</p>
            </div>
          )}
          {notes.map((note) => {
            const d = new Date(note.createdAt)
            const dateStr = isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
            return (
              <div
                key={note.id}
                className="shrink-0 w-36 p-3 rounded-lg flex flex-col gap-1 relative group"
                style={{
                  background: note.color,
                  boxShadow: '2px 2px 8px rgba(0,0,0,0.1)',
                  transform: `rotate(${((parseInt(note.id.slice(-2), 36) % 5) - 2) * 0.8}deg)`,
                }}
              >
                {note.title && (
                  <p
                    className="text-xs font-bold leading-snug"
                    style={{ fontFamily: 'Nunito, sans-serif', color: '#1a0f00' }}
                  >
                    {note.title}
                  </p>
                )}
                <p
                  className="text-xs leading-snug flex-1"
                  style={{ fontFamily: 'Kalam, cursive', color: '#1a0f00' }}
                >
                  {note.content}
                </p>
                <p style={{ fontFamily: 'Outfit, sans-serif', color: 'rgba(26,15,0,0.45)', fontSize: 9 }}>
                  {dateStr}
                </p>
                <button
                  onClick={() => onNotesChange(notes.filter((n) => n.id !== note.id))}
                  className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.12)', color: '#1a0f00', fontSize: 9 }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
