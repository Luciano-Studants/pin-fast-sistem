import { memo } from 'react'
import type { PostIt } from '../types'

export function getDeadlineStatus(postIt: PostIt): {
  label: string
  color: string
  bg: string
} {
  if (postIt.completed) return { label: 'Concluído', color: '#6b7280', bg: '#f3f4f6' }
  if (!postIt.dueDate) return { label: '', color: '', bg: '' }

  const now = new Date()
  const due = new Date(
    postIt.dueDate + 'T' + (postIt.dueTime || '23:59')
  )
  const diffMs = due.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffMs < 0) return { label: 'Atrasado!', color: '#ef4444', bg: '#fee2e2' }
  if (diffDays < 1) return { label: 'Prazo crítico', color: '#f97316', bg: '#ffedd5' }
  if (diffDays < 3) return { label: 'Prazo próximo', color: '#d97706', bg: '#fef9c3' }
  if (diffDays < 7) return { label: 'Prazo próximo', color: '#65a30d', bg: '#f0fdf4' }
  return { label: 'Prazo distante', color: '#22c55e', bg: '#dcfce7' }
}

const ROTATIONS = [-2, 1.5, -1, 2.5, -0.5, 3, -1.8, 2]

interface Props {
  postIt: PostIt
  isDragging: boolean
  scale: number
  onMouseDown: (id: string, e: React.MouseEvent) => void
  onSelect: (p: PostIt) => void
  onComplete: (id: string) => void
  justDragged: React.MutableRefObject<boolean>
}

function PostItCard({
  postIt,
  isDragging,
  scale,
  onMouseDown,
  onSelect,
  onComplete,
  justDragged,
}: Props) {
  const status = getDeadlineStatus(postIt)
  const rot = ROTATIONS[parseInt(postIt.id.slice(-1), 36) % ROTATIONS.length]

  return (
    <div
      className="absolute w-36 min-h-[8.5rem] p-3 flex flex-col"
      style={{
        left: postIt.x,
        top: postIt.y,
        background: postIt.color,
        borderRadius: 3,
        transform: isDragging
          ? `rotate(4deg) scale(${scale * 1.06})`
          : `rotate(${rot}deg) scale(${scale})`,
        boxShadow: isDragging
          ? '8px 10px 28px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.2)'
          : '3px 3px 10px rgba(0,0,0,0.22), 0 1px 3px rgba(0,0,0,0.12)',
        transition: isDragging ? 'box-shadow 0.1s' : 'box-shadow 0.2s, transform 0.2s',
        zIndex: isDragging ? 100 : 1,
        opacity: postIt.completed ? 0.72 : 1,
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        animation: !isDragging ? 'popIn 0.2s ease' : 'none',
      }}
      onMouseDown={(e) => onMouseDown(postIt.id, e)}
      onClick={() => { if (!justDragged.current) onSelect(postIt) }}
    >
      {/* Pin */}
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle at 35% 35%, #ff5555, #aa1111)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.35)',
          zIndex: 2,
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,200,200,0.6)' }} />
      </div>

      <p
        className="text-sm font-bold leading-snug"
        style={{
          fontFamily: 'Kalam, cursive',
          color: '#1a0f00',
          textDecoration: postIt.completed ? 'line-through' : 'none',
          opacity: postIt.completed ? 0.55 : 1,
        }}
      >
        {postIt.title}
      </p>

      {postIt.description && (
        <p
          className="text-xs mt-1 leading-snug opacity-60 line-clamp-2"
          style={{ fontFamily: 'Kalam, cursive', color: '#1a0f00' }}
        >
          {postIt.description}
        </p>
      )}

      <div className="mt-auto pt-2 flex items-end justify-between gap-1">
        <div className="min-w-0">
          {status.label && (
            <span
              className="block font-bold leading-none"
              style={{
                color: status.color,
                fontFamily: 'Outfit, sans-serif',
                fontSize: 9,
              }}
            >
              {status.label}
            </span>
          )}
          {postIt.dueDate && (
            <span
              className="block leading-none mt-0.5 opacity-50"
              style={{
                fontFamily: 'Outfit, sans-serif',
                color: '#1a0f00',
                fontSize: 9,
              }}
            >
              {postIt.dueDate.split('-').reverse().join('/')}
              {postIt.dueTime ? ` ${postIt.dueTime}` : ''}
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onComplete(postIt.id)
          }}
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-110"
          style={{
            background: postIt.completed ? '#22c55e' : 'rgba(0,0,0,0.1)',
            border: '1.5px solid rgba(0,0,0,0.18)',
            color: postIt.completed ? '#fff' : 'transparent',
            fontSize: 10,
            fontWeight: 700,
          }}
          title={postIt.completed ? 'Reabrir tarefa' : 'Concluir tarefa'}
        >
          {postIt.completed ? '✓' : ''}
        </button>
      </div>
    </div>
  )
}

export default memo(PostItCard)
