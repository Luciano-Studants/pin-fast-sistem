import { useState } from 'react'
import type { PostIt, PostItAttachment } from '../../types'
import AttachmentsPanel from './AttachmentsPanel'

const COLORS = [
  { name: 'Amarelo', value: '#fef9c3' },
  { name: 'Vermelho', value: '#fca5a5' },
  { name: 'Azul', value: '#93c5fd' },
  { name: 'Verde', value: '#86efac' },
  { name: 'Laranja', value: '#fdba74' },
  { name: 'Roxo', value: '#c4b5fd' },
  { name: 'Rosa', value: '#f9a8d4' },
  { name: 'Cinza', value: '#d1d5db' },
]

interface Props {
  onClose: () => void
  onCreate: (data: Partial<PostIt>) => void
}

export default function CreatePostItModal({ onClose, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [color, setColor] = useState('#fef9c3')
  const [attachments, setAttachments] = useState<PostItAttachment[]>([])

  const handleCreate = () => {
    if (!title.trim()) return
    onCreate({ title: title.trim(), description: description.trim() || undefined, dueDate: dueDate || undefined, dueTime: dueTime || undefined, color, attachments: attachments.length ? attachments : undefined })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(45,31,20,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: color,
          boxShadow: '0 24px 64px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
          transform: 'rotate(-0.5deg)',
          animation: 'popIn 0.22s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tape decoration */}
        <div className="flex justify-center pt-2 pb-0 relative">
          <div
            className="w-14 h-4 rounded-sm opacity-35 absolute -top-1"
            style={{ background: '#e8d5b7', transform: 'rotate(-1.5deg)' }}
          />
        </div>

        <div className="p-5 pt-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3
                className="text-lg font-black"
                style={{ fontFamily: 'Nunito, sans-serif', color: '#1a0f00' }}
              >
                Novo Post-it
              </h3>
              <p style={{ color: '#7a5c3c', fontFamily: 'Outfit, sans-serif', fontSize: 11 }}>
                Crie e posicione no quadro
              </p>
            </div>
            <button
              onClick={onClose}
              className="opacity-35 hover:opacity-80 transition-opacity text-base mt-0.5"
              style={{ color: '#1a0f00' }}
            >
              ✕
            </button>
          </div>

          <div className="space-y-3.5">
            {/* Title */}
            <div>
              <label
                className="block text-xs font-bold mb-1 uppercase tracking-wide"
                style={{ color: '#5a3e28', fontFamily: 'Outfit, sans-serif', fontSize: 10 }}
              >
                Título *
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Escreva aqui..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-full px-0 py-1 text-base outline-none bg-transparent"
                style={{
                  fontFamily: 'Kalam, cursive',
                  color: '#1a0f00',
                  borderBottom: '1.5px solid rgba(26,15,0,0.2)',
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label
                className="block text-xs font-bold mb-1 uppercase tracking-wide"
                style={{ color: '#5a3e28', fontFamily: 'Outfit, sans-serif', fontSize: 10 }}
              >
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes opcionais..."
                rows={2}
                className="w-full px-0 py-1 text-sm outline-none bg-transparent resize-none"
                style={{
                  fontFamily: 'Kalam, cursive',
                  color: '#1a0f00',
                  borderBottom: '1.5px solid rgba(26,15,0,0.2)',
                }}
              />
            </div>

            {/* Date + time */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label
                  className="block text-xs font-bold mb-1 uppercase tracking-wide"
                  style={{ color: '#5a3e28', fontFamily: 'Outfit, sans-serif', fontSize: 10 }}
                >
                  Data
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs outline-none bg-transparent"
                  style={{ fontFamily: 'Outfit, sans-serif', color: '#1a0f00' }}
                />
              </div>
              <div className="flex-1">
                <label
                  className="block text-xs font-bold mb-1 uppercase tracking-wide"
                  style={{ color: '#5a3e28', fontFamily: 'Outfit, sans-serif', fontSize: 10 }}
                >
                  Hora
                </label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full text-xs outline-none bg-transparent"
                  style={{ fontFamily: 'Outfit, sans-serif', color: '#1a0f00' }}
                />
              </div>
            </div>

            {/* Colors */}
            <div>
              <label
                className="block text-xs font-bold mb-2 uppercase tracking-wide"
                style={{ color: '#5a3e28', fontFamily: 'Outfit, sans-serif', fontSize: 10 }}
              >
                Cor
              </label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    title={c.name}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: c.value,
                      border: color === c.value ? '3px solid #2d1a0a' : '2px solid rgba(0,0,0,0.1)',
                      transform: color === c.value ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Attachments */}
            <AttachmentsPanel attachments={attachments} onChange={setAttachments} />
          </div>

          <div className="flex gap-2 mt-5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'rgba(0,0,0,0.08)',
                color: '#5a3e28',
                fontFamily: 'Nunito, sans-serif',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-40"
              style={{
                background: '#2d1a0a',
                color: '#f0e6d3',
                fontFamily: 'Nunito, sans-serif',
              }}
            >
              Colocar no quadro 📌
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
