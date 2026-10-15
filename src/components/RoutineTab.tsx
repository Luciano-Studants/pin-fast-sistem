import { useState, useEffect, useMemo } from 'react'
import type { PostIt } from '../types'
import { newId } from '../lib/id'
import * as store from '../lib/store/store'

interface RoutineTask {
  id: string
  name: string
  time: string
}

type DayKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom'
type Routine = Record<DayKey, RoutineTask[]>
type RoutineView = 'agenda' | 'semana' | 'rotina'

const DAYS: { key: DayKey; label: string; full: string; jsDay: number }[] = [
  { key: 'seg', label: 'Seg', full: 'Segunda', jsDay: 1 },
  { key: 'ter', label: 'Ter', full: 'Terça',   jsDay: 2 },
  { key: 'qua', label: 'Qua', full: 'Quarta',  jsDay: 3 },
  { key: 'qui', label: 'Qui', full: 'Quinta',  jsDay: 4 },
  { key: 'sex', label: 'Sex', full: 'Sexta',   jsDay: 5 },
  { key: 'sab', label: 'Sáb', full: 'Sábado',  jsDay: 6 },
  { key: 'dom', label: 'Dom', full: 'Domingo', jsDay: 0 },
]

const JS_DAY_TO_KEY: Record<number, DayKey> = {
  0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab',
}

const EMPTY_ROUTINE: Routine = {
  seg: [], ter: [], qua: [], qui: [], sex: [], sab: [], dom: [],
}

function loadRoutine(): Routine {
  try {
    const parsed = store.get<Record<string, unknown> | null>('routine-v1', null)
    if (parsed) {
      const merged = { ...EMPTY_ROUTINE, ...parsed }
      for (const key of Object.keys(EMPTY_ROUTINE) as DayKey[]) {
        if (!Array.isArray(merged[key])) merged[key] = []
      }
      return merged
    }
  } catch {}
  return { ...EMPTY_ROUTINE }
}

function saveRoutine(r: Routine) {
  store.set('routine-v1', r)
}

function isInCurrentWeekWindow(dueDate: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - today.getDay())
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)
  const due = new Date(dueDate + 'T00:00:00')
  return due >= sunday && due <= saturday
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  if (diff === -1) return 'Ontem'
  const day = String(d.getDate()).padStart(2, '0')
  const mon = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${mon}`
}

interface AddFormState {
  day: DayKey
  name: string
  time: string
}

interface Props {
  darkMode: boolean
  postIts: PostIt[]
  onComplete: (id: string) => void
}

export default function RoutineTab({ darkMode, postIts = [], onComplete }: Props) {
  const [view, setView] = useState<RoutineView>('agenda')
  const [routine, setRoutine] = useState<Routine>(loadRoutine)
  const [adding, setAdding] = useState<DayKey | null>(null)
  const [form, setForm] = useState<AddFormState>({ day: 'seg', name: '', time: '' })
  const [editingId, setEditingId] = useState<{ day: DayKey; id: string } | null>(null)
  const [editForm, setEditForm] = useState({ name: '', time: '' })
  const [showCompleted, setShowCompleted] = useState(false)

  const todayJsDay = new Date().getDay()
  const todayKey = JS_DAY_TO_KEY[todayJsDay] ?? 'seg'

  useEffect(() => { saveRoutine(routine) }, [routine])

  const bg = darkMode ? '#161210' : '#f5ede0'
  const border = darkMode ? '#2e2820' : '#e8d5b7'
  const text = darkMode ? '#f0e6d3' : '#2d1a0a'
  const sub = darkMode ? '#8a7a6a' : '#9a7a5a'
  const accent = '#e07b39'
  const card = darkMode ? '#1e1a16' : '#fff'
  const cardBorder = darkMode ? '#2e2820' : '#f0e0c8'

  const _now = new Date()
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`
  const nextWeekDate = new Date(_now)
  nextWeekDate.setDate(_now.getDate() + 7)
  const nextWeekStr = `${nextWeekDate.getFullYear()}-${String(nextWeekDate.getMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getDate()).padStart(2, '0')}`

  const agendaGroups = useMemo(() => {
    const active = postIts.filter((p) => !p.deleted && !p.completed)
    const completed = postIts.filter((p) => !p.deleted && p.completed)

    const overdue: PostIt[] = []
    const dueToday: PostIt[] = []
    const thisWeek: PostIt[] = []
    const future: PostIt[] = []
    const noDate: PostIt[] = []

    for (const p of active) {
      if (!p.dueDate) {
        noDate.push(p)
      } else if (p.dueDate < todayStr) {
        overdue.push(p)
      } else if (p.dueDate === todayStr) {
        dueToday.push(p)
      } else if (p.dueDate <= nextWeekStr) {
        thisWeek.push(p)
      } else {
        future.push(p)
      }
    }

    overdue.sort((a, b) => b.dueDate!.localeCompare(a.dueDate!))
    dueToday.sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'))
    thisWeek.sort((a, b) => {
      const cmp = a.dueDate!.localeCompare(b.dueDate!)
      return cmp !== 0 ? cmp : (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99')
    })
    future.sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    noDate.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    completed.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))

    return { overdue, dueToday, thisWeek, future, noDate, completed }
  }, [postIts, todayStr, nextWeekStr])

  const todayRoutineTasks = useMemo(() => {
    const tasks = routine[todayKey] ?? []
    return [...tasks].sort((a, b) => {
      if (!a.time && !b.time) return 0
      if (!a.time) return 1
      if (!b.time) return -1
      return a.time.localeCompare(b.time)
    })
  }, [routine, todayKey])

  const postItsByDay = useMemo<Record<DayKey, PostIt[]>>(() => {
    const map: Record<DayKey, PostIt[]> = {
      seg: [], ter: [], qua: [], qui: [], sex: [], sab: [], dom: [],
    }
    for (const p of postIts) {
      if (p.deleted || p.completed || !p.dueDate) continue
      if (!isInCurrentWeekWindow(p.dueDate)) continue
      const due = new Date(p.dueDate + 'T00:00:00')
      const key = JS_DAY_TO_KEY[due.getDay()]
      if (key) map[key].push(p)
    }
    return map
  }, [postIts])

  const openAdd = (day: DayKey) => { setAdding(day); setForm({ day, name: '', time: '' }) }
  const confirmAdd = () => {
    if (!form.name.trim()) return
    const task: RoutineTask = { id: newId(), name: form.name.trim(), time: form.time }
    setRoutine((r) => ({ ...r, [adding!]: [...r[adding!], task] }))
    setAdding(null)
  }
  const removeTask = (day: DayKey, id: string) =>
    setRoutine((r) => ({ ...r, [day]: r[day].filter((t) => t.id !== id) }))
  const startEdit = (day: DayKey, task: RoutineTask) => {
    setEditingId({ day, id: task.id }); setEditForm({ name: task.name, time: task.time })
  }
  const confirmEdit = () => {
    if (!editingId || !editForm.name.trim()) return
    const { day, id } = editingId
    setRoutine((r) => ({ ...r, [day]: r[day].map((t) => t.id === id ? { ...t, name: editForm.name.trim(), time: editForm.time } : t) }))
    setEditingId(null)
  }
  const sortedTasks = (tasks: RoutineTask[]) =>
    [...tasks].sort((a, b) => {
      if (!a.time && !b.time) return 0
      if (!a.time) return 1
      if (!b.time) return -1
      return a.time.localeCompare(b.time)
    })

  const totalPending =
    agendaGroups.overdue.length + agendaGroups.dueToday.length +
    agendaGroups.thisWeek.length + agendaGroups.future.length + agendaGroups.noDate.length

  const TAB_VIEWS: { key: RoutineView; label: string; icon: string }[] = [
    { key: 'agenda', label: 'Agenda', icon: '📅' },
    { key: 'semana', label: 'Semana', icon: '🗓' },
    { key: 'rotina', label: 'Rotina Fixa', icon: '🔁' },
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: bg }}>
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 20 }}>🗓️</span>
            <div>
              <h2 className="text-base font-black leading-tight" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>
                Rotina
              </h2>
              <p className="text-xs" style={{ color: sub, fontFamily: 'Outfit, sans-serif' }}>
                {totalPending} pendências · agenda centralizada de todos os quadros
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {TAB_VIEWS.map(({ key, label, icon }) => {
            const active = view === key
            return (
              <button key={key} onClick={() => setView(key)}
                className="flex items-center gap-1.5 min-h-10 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
                style={{
                  background: active ? accent : darkMode ? '#252018' : '#f0e6d3',
                  color: active ? '#fff' : sub,
                  fontFamily: 'Outfit, sans-serif',
                }}>
                <span>{icon}</span>{label}
              </button>
            )
          })}
        </div>
      </div>

      {/* AGENDA */}
      {view === 'agenda' && (
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4">
          {todayRoutineTasks.length > 0 && (
            <AgendaSection title="Rotina de Hoje" subtitle="Tarefas fixas de hoje" icon="🔁" iconColor="#8b5cf6" stripColor="#8b5cf6" darkMode={darkMode}>
              {todayRoutineTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                  style={{ background: darkMode ? '#252018' : '#faf5ff', border: `1px solid ${darkMode ? '#3a2e4a' : '#e9d5ff'}` }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#8b5cf6' }} />
                  {task.time && (
                    <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-lg shrink-0"
                      style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', fontFamily: 'Outfit, sans-serif' }}>
                      {task.time}
                    </span>
                  )}
                  <span className="text-xs font-semibold flex-1" style={{ color: text, fontFamily: 'Outfit, sans-serif' }}>{task.name}</span>
                  <span className="text-[9px] font-bold opacity-40" style={{ color: text }}>FIXO</span>
                </div>
              ))}
            </AgendaSection>
          )}

          {agendaGroups.overdue.length > 0 && (
            <AgendaSection title="Atrasadas" subtitle={`${agendaGroups.overdue.length} com prazo vencido`} icon="⚠️" iconColor="#ef4444" stripColor="#ef4444" darkMode={darkMode}>
              {agendaGroups.overdue.map((p) => (
                <PostItAgendaCard key={p.id} postIt={p} urgency="overdue" darkMode={darkMode} text={text} sub={sub} onComplete={onComplete} />
              ))}
            </AgendaSection>
          )}

          {agendaGroups.dueToday.length > 0 && (
            <AgendaSection
              title="Hoje"
              subtitle={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              icon="📅" iconColor={accent} stripColor={accent} darkMode={darkMode}>
              {agendaGroups.dueToday.map((p) => (
                <PostItAgendaCard key={p.id} postIt={p} urgency="today" darkMode={darkMode} text={text} sub={sub} onComplete={onComplete} />
              ))}
            </AgendaSection>
          )}

          {agendaGroups.thisWeek.length > 0 && (
            <AgendaSection title="Esta semana" subtitle="Próximos 7 dias" icon="📆" iconColor="#10b981" stripColor="#10b981" darkMode={darkMode}>
              {agendaGroups.thisWeek.map((p) => (
                <PostItAgendaCard key={p.id} postIt={p} urgency="week" darkMode={darkMode} text={text} sub={sub} onComplete={onComplete} />
              ))}
            </AgendaSection>
          )}

          {agendaGroups.future.length > 0 && (
            <AgendaSection title="Próximas" subtitle="Além dos próximos 7 dias" icon="🔮" iconColor="#6366f1" stripColor="#6366f1" darkMode={darkMode}>
              {agendaGroups.future.map((p) => (
                <PostItAgendaCard key={p.id} postIt={p} urgency="future" darkMode={darkMode} text={text} sub={sub} onComplete={onComplete} />
              ))}
            </AgendaSection>
          )}

          {agendaGroups.noDate.length > 0 && (
            <AgendaSection title="Sem prazo" subtitle={`${agendaGroups.noDate.length} sem data definida`} icon="📌"
              iconColor={sub} stripColor={darkMode ? '#3a3028' : '#d0c0a0'} darkMode={darkMode}>
              {agendaGroups.noDate.map((p) => (
                <PostItAgendaCard key={p.id} postIt={p} urgency="none" darkMode={darkMode} text={text} sub={sub} onComplete={onComplete} />
              ))}
            </AgendaSection>
          )}

          {agendaGroups.completed.length > 0 && (
            <div>
              <button onClick={() => setShowCompleted((v) => !v)}
                className="flex items-center gap-2 text-xs font-semibold mb-2 opacity-50 hover:opacity-80 transition-opacity"
                style={{ color: text, fontFamily: 'Outfit, sans-serif' }}>
                <span>{showCompleted ? '▼' : '▶'}</span>
                ✅ Concluídas ({agendaGroups.completed.length})
              </button>
              {showCompleted && (
                <div className="space-y-1.5">
                  {agendaGroups.completed.slice(0, 20).map((p) => (
                    <PostItAgendaCard key={p.id} postIt={p} urgency="done" darkMode={darkMode} text={text} sub={sub} onComplete={onComplete} />
                  ))}
                </div>
              )}
            </div>
          )}

          {totalPending === 0 && todayRoutineTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <span style={{ fontSize: 48 }}>🎉</span>
              <p className="mt-3 text-base font-black" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>Tudo em dia!</p>
              <p className="text-sm mt-1" style={{ color: sub, fontFamily: 'Outfit, sans-serif' }}>Nenhuma pendência encontrada</p>
            </div>
          )}
        </div>
      )}

      {/* SEMANA */}
      {view === 'semana' && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="h-full grid" style={{ gridTemplateColumns: `repeat(${DAYS.length}, minmax(180px, 1fr))`, gap: 0, minWidth: DAYS.length * 180 }}>
            {DAYS.map(({ key, full }) => {
              const isToday = key === todayKey
              const tasks = sortedTasks(routine[key])
              const dayPostIts = postItsByDay[key] ?? []
              const totalCount = tasks.length + dayPostIts.length
              return (
                <div key={key} className="flex flex-col h-full"
                  style={{ borderRight: `1px solid ${border}`, background: isToday ? darkMode ? 'rgba(224,123,57,0.07)' : 'rgba(224,123,57,0.05)' : 'transparent' }}>
                  <div className="px-4 py-3 shrink-0 flex items-center justify-between" style={{ borderBottom: `1px solid ${border}` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black" style={{ color: isToday ? accent : text, fontFamily: 'Nunito, sans-serif' }}>{full}</span>
                      {isToday && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: accent, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>hoje</span>}
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: sub }}>{totalCount} {totalCount === 1 ? 'tarefa' : 'tarefas'}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                    {dayPostIts.map((p) => (
                      <div key={p.id} className="group rounded-xl px-3 py-2.5 flex items-start gap-2"
                        style={{ background: p.color ?? '#fef9c3', border: '1px solid rgba(0,0,0,0.08)' }}>
                        <div className="shrink-0 mt-0.5">
                          {p.dueTime
                            ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg tabular-nums" style={{ background: 'rgba(0,0,0,0.12)', color: '#2d1a0a', fontFamily: 'Outfit, sans-serif' }}>{p.dueTime}</span>
                            : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.08)', color: 'rgba(0,0,0,0.35)', fontFamily: 'Outfit, sans-serif' }}>—</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold leading-snug block truncate" style={{ color: '#2d1a0a', fontFamily: 'Outfit, sans-serif' }}>{p.title}</span>
                          <span className="text-[9px] font-bold opacity-50" style={{ color: '#2d1a0a', fontFamily: 'Outfit, sans-serif' }}>📋 post-it</span>
                        </div>
                        <button onClick={() => onComplete(p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-black/10 shrink-0" style={{ color: '#2d1a0a' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                      </div>
                    ))}
                    {tasks.map((task) => {
                      const isEditing = editingId?.day === key && editingId.id === task.id
                      return (
                        <div key={task.id} className="group rounded-xl px-3 py-2.5 transition-all" style={{ background: card, border: `1px solid ${cardBorder}` }}>
                          {isEditing ? (
                            <div className="space-y-1.5">
                              <input autoFocus value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditingId(null) }}
                                className="w-full text-xs rounded-lg px-2 py-1 outline-none"
                                style={{ background: darkMode ? '#1e1a16' : '#fff', color: text, border: `1px solid ${border}`, fontFamily: 'Outfit, sans-serif' }} placeholder="Nome da tarefa" />
                              <input type="time" value={editForm.time} onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))}
                                className="w-full text-xs rounded-lg px-2 py-1 outline-none"
                                style={{ background: darkMode ? '#1e1a16' : '#fff', color: text, border: `1px solid ${border}`, fontFamily: 'Outfit, sans-serif' }} />
                              <div className="flex gap-1">
                                <button onClick={confirmEdit} className="flex-1 text-[10px] font-bold py-1 rounded-lg" style={{ background: accent, color: '#fff' }}>Salvar</button>
                                <button onClick={() => setEditingId(null)} className="flex-1 text-[10px] font-bold py-1 rounded-lg" style={{ background: darkMode ? '#2e2820' : '#f0e6d3', color: sub }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <div className="shrink-0 mt-0.5">
                                {task.time
                                  ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg tabular-nums" style={{ background: isToday ? 'rgba(224,123,57,0.15)' : darkMode ? '#2e2820' : '#f0e6d3', color: isToday ? accent : sub, fontFamily: 'Outfit, sans-serif' }}>{task.time}</span>
                                  : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg" style={{ background: darkMode ? '#2e2820' : '#f0e6d3', color: darkMode ? '#4a3e30' : '#d0c0a0', fontFamily: 'Outfit, sans-serif' }}>—</span>}
                              </div>
                              <span className="flex-1 text-xs font-semibold leading-snug" style={{ color: text, fontFamily: 'Outfit, sans-serif' }}>{task.name}</span>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => startEdit(key, task)} className="p-1 rounded-lg hover:bg-black/8 transition-colors" style={{ color: sub }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button onClick={() => removeTask(key, task.id)} className="p-1 rounded-lg hover:bg-red-500/10 transition-colors" style={{ color: '#ef4444' }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {totalCount === 0 && <div className="pt-4 text-center"><p className="text-xs" style={{ color: darkMode ? '#4a3e30' : '#c8b090', fontFamily: 'Outfit, sans-serif' }}>Nenhuma tarefa</p></div>}
                  </div>
                  <div className="px-3 pb-3 pt-1 shrink-0" style={{ borderTop: `1px solid ${border}` }}>
                    {adding === key ? (
                      <div className="space-y-1.5 pt-2">
                        <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') setAdding(null) }}
                          className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
                          style={{ background: darkMode ? '#1e1a16' : '#fff', color: text, border: `1.5px solid ${accent}`, fontFamily: 'Outfit, sans-serif' }} placeholder="Nome da tarefa…" />
                        <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                          className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
                          style={{ background: darkMode ? '#1e1a16' : '#fff', color: text, border: `1px solid ${border}`, fontFamily: 'Outfit, sans-serif' }} />
                        <div className="flex gap-1">
                          <button onClick={confirmAdd} disabled={!form.name.trim()} className="flex-1 text-[10px] font-bold py-1.5 rounded-lg disabled:opacity-40" style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>Adicionar</button>
                          <button onClick={() => setAdding(null)} className="flex-1 text-[10px] font-bold py-1.5 rounded-lg" style={{ background: darkMode ? '#2e2820' : '#f0e6d3', color: sub, fontFamily: 'Nunito, sans-serif' }}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => openAdd(key)} className="w-full flex items-center justify-center gap-1.5 mt-2 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                        style={{ border: `1.5px dashed ${darkMode ? '#3a3028' : '#e8d5b7'}`, color: sub, fontFamily: 'Outfit, sans-serif', background: 'transparent' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Adicionar tarefa
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ROTINA FIXA */}
      {view === 'rotina' && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="h-full grid" style={{ gridTemplateColumns: `repeat(${DAYS.length}, minmax(180px, 1fr))`, gap: 0, minWidth: DAYS.length * 180 }}>
            {DAYS.map(({ key, full }) => {
              const isToday = key === todayKey
              const tasks = sortedTasks(routine[key])
              return (
                <div key={key} className="flex flex-col h-full"
                  style={{ borderRight: `1px solid ${border}`, background: isToday ? darkMode ? 'rgba(224,123,57,0.07)' : 'rgba(224,123,57,0.05)' : 'transparent' }}>
                  <div className="px-4 py-3 shrink-0 flex items-center justify-between" style={{ borderBottom: `1px solid ${border}` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black" style={{ color: isToday ? accent : text, fontFamily: 'Nunito, sans-serif' }}>{full}</span>
                      {isToday && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: accent, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>hoje</span>}
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: sub }}>{tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                    {tasks.map((task) => {
                      const isEditing = editingId?.day === key && editingId.id === task.id
                      return (
                        <div key={task.id} className="group rounded-xl px-3 py-2.5 transition-all" style={{ background: card, border: `1px solid ${cardBorder}` }}>
                          {isEditing ? (
                            <div className="space-y-1.5">
                              <input autoFocus value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditingId(null) }}
                                className="w-full text-xs rounded-lg px-2 py-1 outline-none"
                                style={{ background: darkMode ? '#1e1a16' : '#fff', color: text, border: `1px solid ${border}`, fontFamily: 'Outfit, sans-serif' }} placeholder="Nome da tarefa" />
                              <input type="time" value={editForm.time} onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))}
                                className="w-full text-xs rounded-lg px-2 py-1 outline-none"
                                style={{ background: darkMode ? '#1e1a16' : '#fff', color: text, border: `1px solid ${border}`, fontFamily: 'Outfit, sans-serif' }} />
                              <div className="flex gap-1">
                                <button onClick={confirmEdit} className="flex-1 text-[10px] font-bold py-1 rounded-lg" style={{ background: accent, color: '#fff' }}>Salvar</button>
                                <button onClick={() => setEditingId(null)} className="flex-1 text-[10px] font-bold py-1 rounded-lg" style={{ background: darkMode ? '#2e2820' : '#f0e6d3', color: sub }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <div className="shrink-0 mt-0.5">
                                {task.time
                                  ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg tabular-nums" style={{ background: isToday ? 'rgba(224,123,57,0.15)' : darkMode ? '#2e2820' : '#f0e6d3', color: isToday ? accent : sub, fontFamily: 'Outfit, sans-serif' }}>{task.time}</span>
                                  : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg" style={{ background: darkMode ? '#2e2820' : '#f0e6d3', color: darkMode ? '#4a3e30' : '#d0c0a0', fontFamily: 'Outfit, sans-serif' }}>—</span>}
                              </div>
                              <span className="flex-1 text-xs font-semibold leading-snug" style={{ color: text, fontFamily: 'Outfit, sans-serif' }}>{task.name}</span>
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => startEdit(key, task)} className="p-1 rounded-lg hover:bg-black/8 transition-colors" style={{ color: sub }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button onClick={() => removeTask(key, task.id)} className="p-1 rounded-lg hover:bg-red-500/10 transition-colors" style={{ color: '#ef4444' }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {tasks.length === 0 && <div className="pt-4 text-center"><p className="text-xs" style={{ color: darkMode ? '#4a3e30' : '#c8b090', fontFamily: 'Outfit, sans-serif' }}>Nenhuma tarefa fixa</p></div>}
                  </div>
                  <div className="px-3 pb-3 pt-1 shrink-0" style={{ borderTop: `1px solid ${border}` }}>
                    {adding === key ? (
                      <div className="space-y-1.5 pt-2">
                        <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') setAdding(null) }}
                          className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
                          style={{ background: darkMode ? '#1e1a16' : '#fff', color: text, border: `1.5px solid ${accent}`, fontFamily: 'Outfit, sans-serif' }} placeholder="Nome da tarefa…" />
                        <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                          className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
                          style={{ background: darkMode ? '#1e1a16' : '#fff', color: text, border: `1px solid ${border}`, fontFamily: 'Outfit, sans-serif' }} />
                        <div className="flex gap-1">
                          <button onClick={confirmAdd} disabled={!form.name.trim()} className="flex-1 text-[10px] font-bold py-1.5 rounded-lg disabled:opacity-40" style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>Adicionar</button>
                          <button onClick={() => setAdding(null)} className="flex-1 text-[10px] font-bold py-1.5 rounded-lg" style={{ background: darkMode ? '#2e2820' : '#f0e6d3', color: sub, fontFamily: 'Nunito, sans-serif' }}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => openAdd(key)} className="w-full flex items-center justify-center gap-1.5 mt-2 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                        style={{ border: `1.5px dashed ${darkMode ? '#3a3028' : '#e8d5b7'}`, color: sub, fontFamily: 'Outfit, sans-serif', background: 'transparent' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Adicionar tarefa fixa
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface AgendaSectionProps {
  title: string
  subtitle: string
  icon: string
  iconColor: string
  stripColor: string
  darkMode: boolean
  children: React.ReactNode
}

function AgendaSection({ title, subtitle, icon, iconColor, stripColor, darkMode, children }: AgendaSectionProps) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${darkMode ? '#2e2820' : '#ede0cc'}` }}>
      <div className="flex items-center gap-2.5 px-4 py-2.5"
        style={{ background: darkMode ? '#1e1a16' : '#faf6f0', borderLeft: `4px solid ${stripColor}`, borderBottom: `1px solid ${darkMode ? '#2e2820' : '#ede0cc'}` }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <div>
          <p className="text-xs font-black leading-none" style={{ color: iconColor, fontFamily: 'Nunito, sans-serif' }}>{title}</p>
          <p className="text-[9px] mt-0.5" style={{ color: darkMode ? '#6a5a4a' : '#b09a7a', fontFamily: 'Outfit, sans-serif' }}>{subtitle}</p>
        </div>
      </div>
      <div className="p-3 space-y-1.5" style={{ background: darkMode ? '#161210' : '#fefcf8' }}>
        {children}
      </div>
    </div>
  )
}

interface PostItAgendaCardProps {
  postIt: PostIt
  urgency: 'overdue' | 'today' | 'week' | 'future' | 'none' | 'done'
  darkMode: boolean
  text: string
  sub: string
  onComplete: (id: string) => void
}

function PostItAgendaCard({ postIt: p, urgency, text, onComplete }: PostItAgendaCardProps) {
  const urgencyColors: Record<string, string> = {
    overdue: '#ef4444', today: '#e07b39', week: '#10b981',
    future: '#6366f1', none: '#9a8070', done: '#888',
  }
  const dotColor = urgencyColors[urgency] ?? '#888'
  const isDone = urgency === 'done'

  const fmtD = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    const now = new Date(); now.setHours(0,0,0,0)
    const diff = Math.round((d.getTime() - now.getTime()) / 86400000)
    if (diff === 0) return 'Hoje'
    if (diff === 1) return 'Amanhã'
    if (diff === -1) return 'Ontem'
    const day = String(d.getDate()).padStart(2, '0')
    const mon = String(d.getMonth() + 1).padStart(2, '0')
    return `${day}/${mon}`
  }

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:opacity-90"
      style={{ background: p.color ?? '#fef9f3', border: '1px solid rgba(0,0,0,0.07)', opacity: isDone ? 0.6 : 1 }}>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
      {p.dueTime && (
        <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-lg shrink-0"
          style={{ background: 'rgba(0,0,0,0.1)', color: '#2d1a0a', fontFamily: 'Outfit, sans-serif' }}>
          {p.dueTime}
        </span>
      )}
      <span className="flex-1 text-xs font-semibold leading-snug truncate"
        style={{ color: '#2d1a0a', fontFamily: 'Outfit, sans-serif', textDecoration: isDone ? 'line-through' : 'none' }}>
        {p.title}
      </span>
      {p.dueDate && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg shrink-0"
          style={{
            background: urgency === 'overdue' ? 'rgba(239,68,68,0.18)' : 'rgba(0,0,0,0.08)',
            color: urgency === 'overdue' ? '#ef4444' : '#5a3a1a',
            fontFamily: 'Outfit, sans-serif',
          }}>
          {fmtD(p.dueDate)}
        </span>
      )}
      {!isDone && (
        <button onClick={() => onComplete(p.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-black/10 shrink-0"
          title="Concluir" style={{ color: '#2d1a0a' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      )}
    </div>
  )
}
