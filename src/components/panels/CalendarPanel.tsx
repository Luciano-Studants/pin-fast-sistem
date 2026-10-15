import { useState } from 'react'
import type { PostIt } from '../../types'

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface Props {
  postIts: PostIt[]
}

export default function CalendarPanel({ postIts }: Props) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => { setViewDate(new Date(year, month - 1, 1)); setSelectedDay(null) }
  const nextMonth = () => { setViewDate(new Date(year, month + 1, 1)); setSelectedDay(null) }

  const getDayPostIts = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return postIts.filter((p) => p.dueDate === dateStr && !p.deleted)
  }

  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear()

  const isPast = (day: number) =>
    new Date(year, month, day) <
    new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const selectedDayPosts = selectedDay ? getDayPostIts(selectedDay) : []

  return (
    <div className="size-full flex flex-col sm:flex-row overflow-hidden" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Calendar grid */}
      <div className="w-full sm:w-60 flex flex-col p-3 shrink-0 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={prevMonth}
            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors text-sm font-bold"
            style={{ color: '#7a5c3c' }}
          >
            ‹
          </button>
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: '#2d1a0a', fontFamily: 'Nunito, sans-serif' }}
          >
            {MONTHS_PT[month]} — {year}
          </span>
          <button
            onClick={nextMonth}
            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors text-sm font-bold"
            style={{ color: '#7a5c3c' }}
          >
            ›
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_PT.map((d) => (
            <div
              key={d}
              className="text-center font-bold"
              style={{ color: '#c4a47c', fontSize: 9 }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-y-0.5 flex-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayPosts = getDayPostIts(day)
            const todayFlag = isToday(day)
            const pastFlag = isPast(day)
            const selected = selectedDay === day

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className="flex flex-col items-center py-0.5 rounded-lg transition-all hover:bg-orange-50"
                style={{
                  background: selected && !todayFlag ? '#f5ede0' : 'transparent',
                }}
              >
                <span
                  className="w-5 h-5 flex items-center justify-center rounded-full font-semibold"
                  style={{
                    fontSize: 10,
                    background: todayFlag ? '#e07b39' : 'transparent',
                    color: todayFlag ? '#fff' : pastFlag ? '#c4a47c' : '#2d1a0a',
                    fontWeight: todayFlag ? 800 : 500,
                    border: pastFlag && !todayFlag ? '1.5px solid #c4a47c' : 'none',
                    opacity: pastFlag && !todayFlag ? 0.55 : 1,
                  }}
                >
                  {day}
                </span>
                {dayPosts.length > 0 && (
                  <div className="flex gap-px mt-0.5">
                    {dayPosts.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        className="w-1 h-1 rounded-full"
                        style={{
                          background:
                            p.color === '#fef9c3' ? '#e07b39' : p.color,
                        }}
                      />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day detail */}
      <div
        className="flex-1 border-l overflow-y-auto p-3"
        style={{ borderColor: '#e8d5b7' }}
      >
        {selectedDay ? (
          <>
            <p
              className="text-xs font-bold mb-2"
              style={{ color: '#2d1a0a', fontFamily: 'Nunito, sans-serif' }}
            >
              {selectedDay} de {MONTHS_PT[month]}
              {isToday(selectedDay) && (
                <span
                  className="ml-2 px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: '#e07b39', fontSize: 9 }}
                >
                  Hoje
                </span>
              )}
            </p>
            {selectedDayPosts.length === 0 ? (
              <p style={{ color: '#c4a47c', fontSize: 11 }}>Nenhuma tarefa neste dia.</p>
            ) : (
              <div className="space-y-1.5">
                {selectedDayPosts.map((p) => (
                  <div
                    key={p.id}
                    className="p-2 rounded-lg"
                    style={{ background: p.color, fontSize: 11 }}
                  >
                    <p
                      className="font-semibold leading-snug"
                      style={{
                        fontFamily: 'Kalam, cursive',
                        color: '#1a0f00',
                        textDecoration: p.completed ? 'line-through' : 'none',
                        opacity: p.completed ? 0.6 : 1,
                      }}
                    >
                      {p.title}
                    </p>
                    {p.dueTime && (
                      <p
                        style={{
                          fontFamily: 'Outfit, sans-serif',
                          color: '#5a3e28',
                          fontSize: 9,
                        }}
                      >
                        {p.dueTime}
                      </p>
                    )}
                    <p
                      style={{
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: 9,
                        color: p.completed ? '#22c55e' : '#5a3e28',
                        marginTop: 2,
                        fontWeight: 600,
                      }}
                    >
                      {p.completed ? '✓ Concluída' : '○ Pendente'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p style={{ color: '#c4a47c', fontSize: 11 }}>
            Selecione um dia para ver as tarefas.
          </p>
        )}
      </div>
    </div>
  )
}
