import { useState, useEffect } from 'react'
import type { PostIt, PostItAttachment } from '../../types'
import { getDeadlineStatus } from '../PostItCard'
import AttachmentsPanel from './AttachmentsPanel'

const COLORS = [
  '#fef9c3', '#fca5a5', '#93c5fd', '#86efac',
  '#fdba74', '#c4b5fd', '#f9a8d4', '#d1d5db',
]

function getTimeRemaining(postIt: PostIt): string {
  if (!postIt.dueDate || postIt.completed) return ''

  const now = new Date()
  const due = new Date(postIt.dueDate + 'T' + (postIt.dueTime || '23:59'))
  const diffMs = due.getTime() - now.getTime()

  if (diffMs < 0) {
    const abs = Math.abs(diffMs)
    const days = Math.floor(abs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((abs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const mins = Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60))
    if (days > 0) return `Vencido há ${days}d ${hours}h ${mins}min`
    if (hours > 0) return `Vencido há ${hours}h ${mins}min`
    return `Vencido há ${mins}min`
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000)

  if (days > 0) return `${days} dias, ${hours} horas e ${mins} minutos`
  if (hours > 0) return `${hours} horas, ${mins} minutos e ${secs} segundos`
  if (mins > 0) return `${mins} minutos e ${secs} segundos`
  return `${secs} segundos`
}

interface Props {
  postIt: PostIt
  onClose: () => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onUpdate: (updated: PostIt) => void
}

export default function PostItDetailModal({
  postIt,
  onClose,
  onComplete,
  onDelete,
  onUpdate,
}: Props) {
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining(postIt))
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(postIt.title)
  const [editDesc, setEditDesc] = useState(postIt.description || '')
  const [editDate, setEditDate] = useState(postIt.dueDate || '')
  const [editTime, setEditTime] = useState(postIt.dueTime || '')
  const [editColor, setEditColor] = useState(postIt.color)
  const [attachments, setAttachments] = useState<PostItAttachment[]>(postIt.attachments ?? [])

  const status = getDeadlineStatus(postIt)

  useEffect(() => {
    setTimeRemaining(getTimeRemaining(postIt))
    const interval = setInterval(() => setTimeRemaining(getTimeRemaining(postIt)), 1000)
    return () => clearInterval(interval)
  }, [postIt.dueDate, postIt.dueTime, postIt.completed])

  const handleSave = () => {
    onUpdate({
      ...postIt,
      title: editTitle.trim() || postIt.title,
      description: editDesc.trim() || undefined,
      dueDate: editDate || undefined,
      dueTime: editTime || undefined,
      color: editColor,
      attachments: attachments.length ? attachments : undefined,
    })
    setEditing(false)
  }

  const bg = editing ? editColor : postIt.color

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(45,31,20,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: bg,
          boxShadow: '0 28px 72px rgba(0,0,0,0.38), 0 2px 10px rgba(0,0,0,0.15)',
          transform: 'rotate(-0.3deg)',
          animation: 'popIn 0.22s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pin */}
        <div className="flex justify-center pt-3">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle at 35% 35%, #ff5555, #aa1111)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: 'rgba(255,200,200,0.55)' }}
            />
          </div>
        </div>

        <div className="p-6 pt-3">
          {/* Status + close */}
          <div className="flex items-center justify-between mb-4">
            {status.label ? (
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: status.bg,
                  color: status.color,
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                {status.label}
              </span>
            ) : (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(0,0,0,0.08)', color: '#5a3e28', fontFamily: 'Outfit, sans-serif' }}
              >
                Em andamento
              </span>
            )}
            <button
              onClick={onClose}
              className="opacity-35 hover:opacity-80 transition-opacity"
              style={{ color: '#1a0f00' }}
            >
              ✕
            </button>
          </div>

          {/* Title */}
          {editing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full text-xl font-black bg-transparent outline-none mb-3"
              style={{
                fontFamily: 'Nunito, sans-serif',
                color: '#1a0f00',
                borderBottom: '1.5px solid rgba(26,15,0,0.25)',
              }}
            />
          ) : (
            <h2
              className="text-xl font-black mb-3"
              style={{
                fontFamily: 'Nunito, sans-serif',
                color: '#1a0f00',
                textDecoration: postIt.completed ? 'line-through' : 'none',
                opacity: postIt.completed ? 0.55 : 1,
              }}
            >
              {postIt.title}
            </h2>
          )}

          {/* Description */}
          {editing ? (
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Descrição..."
              rows={3}
              className="w-full text-sm bg-transparent outline-none resize-none mb-4"
              style={{
                fontFamily: 'Kalam, cursive',
                color: '#1a0f00',
                borderBottom: '1.5px solid rgba(26,15,0,0.2)',
              }}
            />
          ) : (
            postIt.description && (
              <p
                className="text-sm mb-4 leading-relaxed"
                style={{ fontFamily: 'Kalam, cursive', color: '#3d2a15' }}
              >
                {postIt.description}
              </p>
            )
          )}

          {/* Date / time / countdown */}
          {(editing || postIt.dueDate) && (
            <div
              className="rounded-xl p-3 mb-4 space-y-2"
              style={{ background: 'rgba(0,0,0,0.06)' }}
            >
              {editing ? (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold mb-0.5 uppercase" style={{ color: '#5a3e28', fontSize: 9 }}>Data</label>
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                           className="w-full text-xs bg-transparent outline-none" style={{ fontFamily: 'Outfit, sans-serif', color: '#1a0f00' }}/>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold mb-0.5 uppercase" style={{ color: '#5a3e28', fontSize: 9 }}>Hora</label>
                    <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)}
                           className="w-full text-xs bg-transparent outline-none" style={{ fontFamily: 'Outfit, sans-serif', color: '#1a0f00' }}/>
                  </div>
                </div>
              ) : (
                <div className="flex gap-5">
                  {postIt.dueDate && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7a5c3c', fontFamily: 'Outfit, sans-serif', fontSize: 9 }}>DATA</p>
                      <p className="text-sm font-semibold" style={{ fontFamily: 'Outfit, sans-serif', color: '#1a0f00' }}>
                        {postIt.dueDate.split('-').reverse().join('/')}
                      </p>
                    </div>
                  )}
                  {postIt.dueTime && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7a5c3c', fontFamily: 'Outfit, sans-serif', fontSize: 9 }}>HORA</p>
                      <p className="text-sm font-semibold" style={{ fontFamily: 'Outfit, sans-serif', color: '#1a0f00' }}>{postIt.dueTime}</p>
                    </div>
                  )}
                </div>
              )}

              {timeRemaining && !editing && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7a5c3c', fontFamily: 'Outfit, sans-serif', fontSize: 9 }}>TEMPO RESTANTE</p>
                  <p className="text-base font-black" style={{ fontFamily: 'Nunito, sans-serif', color: status.color || '#2d1a0a' }}>
                    {timeRemaining}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Color picker when editing */}
          {editing && (
            <div className="mb-4">
              <label className="block text-xs font-bold mb-1.5 uppercase" style={{ color: '#5a3e28', fontFamily: 'Outfit, sans-serif', fontSize: 9 }}>COR</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setEditColor(c)}
                          className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                          style={{ background: c, border: editColor === c ? '3px solid #2d1a0a' : '2px solid rgba(0,0,0,0.1)' }}/>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div className="mb-4">
            <AttachmentsPanel
              attachments={attachments}
              onChange={setAttachments}
              readonly={!editing}
            />
          </div>

          {/* Completed at */}
          {postIt.completed && postIt.completedAt && (
            <p
              className="text-xs mb-4"
              style={{ color: '#5a3e28', fontFamily: 'Outfit, sans-serif' }}
            >
              ✓ Concluída em{' '}
              {new Date(postIt.completedAt).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(0,0,0,0.08)', color: '#5a3e28', fontFamily: 'Nunito, sans-serif' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold hover:opacity-90"
                  style={{ background: '#2d1a0a', color: '#f0e6d3', fontFamily: 'Nunito, sans-serif' }}
                >
                  Salvar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                  style={{ background: 'rgba(0,0,0,0.08)', color: '#5a3e28', fontFamily: 'Nunito, sans-serif' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => onComplete(postIt.id)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                  style={{
                    background: postIt.completed ? '#2d1a0a' : '#22c55e',
                    color: '#fff',
                    fontFamily: 'Nunito, sans-serif',
                  }}
                >
                  {postIt.completed ? 'Reabrir' : 'Concluir ✓'}
                </button>
                <button
                  onClick={() => onDelete(postIt.id)}
                  className="py-2.5 px-3.5 rounded-xl text-sm transition-all hover:opacity-80"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                  title="Excluir"
                >
                  🗑
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
