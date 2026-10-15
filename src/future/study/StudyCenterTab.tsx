import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { PostIt, TextDocument, Spreadsheet } from '../../types'
import type { StudySubject, StudySession, StudyGoal, StudyProfile } from './types'

// ── XP config ─────────────────────────────────────────────────────────────────

const XP_VALUES = {
  daily_login: 10,
  study_session_complete: 30,
  daily_goal_complete: 25,
  weekly_streak_7: 100,
} as const

// ── Level system ──────────────────────────────────────────────────────────────

const LEVELS = [
  { level: 1, xp: 0, name: 'Iniciante', icon: '🌱' },
  { level: 2, xp: 200, name: 'Estudante', icon: '📚' },
  { level: 3, xp: 500, name: 'Aprendiz', icon: '🧠' },
  { level: 4, xp: 1000, name: 'Dedicado', icon: '⚡' },
  { level: 5, xp: 2000, name: 'Focado', icon: '🔥' },
  { level: 6, xp: 3500, name: 'Avançado', icon: '🏆' },
  { level: 7, xp: 5500, name: 'Especialista', icon: '💎' },
  { level: 8, xp: 8000, name: 'Mestre', icon: '🚀' },
  { level: 9, xp: 12000, name: 'Elite', icon: '👑' },
]

function getLevel(xp: number) {
  let cur = LEVELS[0]
  for (const l of LEVELS) { if (xp >= l.xp) cur = l }
  const nextIdx = LEVELS.findIndex((l) => l.level === cur.level) + 1
  const nxt = nextIdx < LEVELS.length ? LEVELS[nextIdx] : cur
  return { cur, nxt }
}

// ── Achievements ──────────────────────────────────────────────────────────────

const ACHIEVEMENTS = [
  { id: 'first_session', icon: '🏅', title: 'Primeira sessão', desc: 'Complete sua primeira sessão de estudo' },
  { id: 'hours_10', icon: '📚', title: '10 horas estudadas', desc: 'Acumule 10 horas de estudo' },
  { id: 'streak_3', icon: '🔥', title: '3 dias consecutivos', desc: 'Mantenha sequência de 3 dias' },
  { id: 'sessions_5', icon: '⚡', title: '5 sessões completas', desc: 'Complete 5 sessões de Pomodoro' },
  { id: 'streak_7', icon: '💪', title: '7 dias consecutivos', desc: 'Mantenha sequência de 7 dias' },
  { id: 'sessions_20', icon: '🎯', title: '20 sessões', desc: 'Complete 20 sessões de estudo' },
  { id: 'level_5', icon: '🚀', title: 'Nível 5 — Focado', desc: 'Alcance o nível 5' },
  { id: 'hours_50', icon: '👑', title: '50 horas estudadas', desc: 'Acumule 50 horas de estudo' },
]

// ── Challenges ────────────────────────────────────────────────────────────────

interface Challenge { id: string; title: string; xpReward: number; progress: number; target: number; unit: string; completedAt?: string }

const INITIAL_CHALLENGES: Challenge[] = [
  { id: 'c1', title: 'Estude 3 dias seguidos', xpReward: 50, progress: 3, target: 3, unit: 'dias', completedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'c2', title: 'Estude 5 horas nesta semana', xpReward: 100, progress: 3.5, target: 5, unit: 'horas' },
  { id: 'c3', title: 'Complete 5 sessões de Pomodoro', xpReward: 75, progress: 3, target: 5, unit: 'sessões' },
  { id: 'c4', title: 'Responda 20 questões', xpReward: 100, progress: 12, target: 20, unit: 'questões' },
  { id: 'c5', title: 'Estude uma matéria por 10 horas', xpReward: 200, progress: 7.6, target: 10, unit: 'horas' },
  { id: 'c6', title: 'Complete 7 dias consecutivos', xpReward: 250, progress: 4, target: 7, unit: 'dias' },
]

// ── Seed data ─────────────────────────────────────────────────────────────────

const _now = new Date()
const _d = (n: number) => { const r = new Date(_now); r.setDate(r.getDate() + n); return r.toISOString() }
const _ds = (n: number) => _d(n).slice(0, 10)

const SEED_SUBJECTS: StudySubject[] = [
  { id: 's1', name: 'Banco de Dados', color: '#93c5fd', icon: '📘', professor: 'Prof. Almeida', semester: '4º Semestre', hoursGoal: 40, minutesStudied: 760, sessions: 16, createdAt: _d(-30), description: 'Modelagem relacional, SQL, normalização e otimização.' },
  { id: 's2', name: 'Programação', color: '#86efac', icon: '📗', professor: 'Prof. Costa', semester: '3º Semestre', hoursGoal: 60, minutesStudied: 500, sessions: 12, createdAt: _d(-25), description: 'Algoritmos, estruturas de dados e paradigmas.' },
  { id: 's3', name: 'Eng. de Software', color: '#fca5a5', icon: '📙', semester: '4º Semestre', hoursGoal: 30, minutesStudied: 360, sessions: 8, createdAt: _d(-20) },
  { id: 's4', name: 'Redes', color: '#fdba74', icon: '📕', semester: '3º Semestre', hoursGoal: 25, minutesStudied: 270, sessions: 6, createdAt: _d(-15) },
  { id: 's5', name: 'TCC', color: '#c4b5fd', icon: '📒', hoursGoal: 120, minutesStudied: 180, sessions: 4, createdAt: _d(-10), description: 'Trabalho de Conclusão de Curso.' },
]

const SEED_SESSIONS: StudySession[] = [
  { id: 'm1', subjectId: 's1', subjectName: 'Banco de Dados', subjectColor: '#93c5fd', subjectIcon: '📘', minutesStudied: 25, startedAt: _d(0), finishedAt: _d(0), preset: 'Clássico' },
  { id: 'm2', subjectId: 's2', subjectName: 'Programação', subjectColor: '#86efac', subjectIcon: '📗', minutesStudied: 50, startedAt: _d(0), finishedAt: _d(0), preset: 'Foco' },
  { id: 'm3', subjectId: 's3', subjectName: 'Eng. de Software', subjectColor: '#fca5a5', subjectIcon: '📙', minutesStudied: 80, startedAt: _d(-1), finishedAt: _d(-1), preset: 'Profundo' },
  { id: 'm4', subjectId: 's1', subjectName: 'Banco de Dados', subjectColor: '#93c5fd', subjectIcon: '📘', minutesStudied: 50, startedAt: _d(-1), finishedAt: _d(-1), preset: 'Foco' },
  { id: 'm5', subjectId: 's4', subjectName: 'Redes', subjectColor: '#fdba74', subjectIcon: '📕', minutesStudied: 25, startedAt: _d(-2), finishedAt: _d(-2), preset: 'Clássico' },
  { id: 'm6', subjectId: 's5', subjectName: 'TCC', subjectColor: '#c4b5fd', subjectIcon: '📒', minutesStudied: 90, startedAt: _d(-2), finishedAt: _d(-2), preset: 'Profundo' },
  { id: 'm7', subjectId: 's1', subjectName: 'Banco de Dados', subjectColor: '#93c5fd', subjectIcon: '📘', minutesStudied: 25, startedAt: _d(-3), finishedAt: _d(-3), preset: 'Clássico' },
  { id: 'm8', subjectId: 's2', subjectName: 'Programação', subjectColor: '#86efac', subjectIcon: '📗', minutesStudied: 50, startedAt: _d(-4), finishedAt: _d(-4), preset: 'Foco' },
  { id: 'm9', subjectId: 's5', subjectName: 'TCC', subjectColor: '#c4b5fd', subjectIcon: '📒', minutesStudied: 25, startedAt: _d(-5), finishedAt: _d(-5), preset: 'Clássico' },
  { id: 'm10', subjectId: 's3', subjectName: 'Eng. de Software', subjectColor: '#fca5a5', subjectIcon: '📙', minutesStudied: 50, startedAt: _d(-6), finishedAt: _d(-6), preset: 'Foco' },
]

const SEED_PROFILE: StudyProfile = {
  xp: 1250,
  streak: 7,
  bestStreak: 14,
  lastActiveDate: _ds(0),
  totalMinutesStudied: 5200,
  totalSessions: 143,
  loginDates: [_ds(0), _ds(-1), _ds(-2), _ds(-3), _ds(-4), _ds(-5), _ds(-6), _ds(-8), _ds(-9), _ds(-14)],
  achievements: ['first_session', 'hours_10', 'streak_3', 'sessions_5'],
}

const SEED_GOALS: StudyGoal[] = [
  { id: 'g1', type: 'daily', targetMinutes: 60, label: 'Meta diária' },
  { id: 'g2', type: 'weekly', targetMinutes: 600, label: 'Meta semanal' },
  { id: 'g3', type: 'monthly', targetMinutes: 1800, label: 'Meta mensal' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function ls<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback }
}
function lsSave(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

function formatMins(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

function formatSecs(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ── Nav ───────────────────────────────────────────────────────────────────────

type Screen = 'overview' | 'subjects' | 'subject-detail' | 'pomodoro' | 'history' | 'goals' | 'challenges' | 'progress' | 'achievements'

const NAV: { key: Screen; icon: string; label: string }[] = [
  { key: 'overview', icon: '📊', label: 'Visão geral' },
  { key: 'subjects', icon: '📚', label: 'Minhas matérias' },
  { key: 'pomodoro', icon: '⏱️', label: 'Sessão de estudo' },
  { key: 'history', icon: '📅', label: 'Histórico' },
  { key: 'goals', icon: '🎯', label: 'Metas' },
  { key: 'challenges', icon: '🏆', label: 'Desafios' },
  { key: 'progress', icon: '📈', label: 'Desempenho' },
  { key: 'achievements', icon: '⭐', label: 'Conquistas' },
]

// ── Pomodoro presets ──────────────────────────────────────────────────────────

type PomPreset = 'classic' | 'focus' | 'deep' | 'custom'

const POM_PRESETS: { key: PomPreset; label: string; icon: string; study: number; short: number; long: number; sessions: number }[] = [
  { key: 'classic', label: 'Clássico', icon: '🍅', study: 25, short: 5, long: 15, sessions: 4 },
  { key: 'focus', label: 'Foco', icon: '⚡', study: 50, short: 10, long: 30, sessions: 3 },
  { key: 'deep', label: 'Profundo', icon: '🧠', study: 90, short: 20, long: 30, sessions: 2 },
  { key: 'custom', label: 'Personalizado', icon: '⚙', study: 25, short: 5, long: 15, sessions: 4 },
]

// ── Subject form ──────────────────────────────────────────────────────────────

const SUBJECT_ICONS = ['📘', '📗', '📙', '📕', '📒', '🧮', '🔬', '⚗️', '🖥️', '📐', '🌍', '🎨']
const SUBJECT_COLORS = ['#93c5fd', '#86efac', '#fca5a5', '#fdba74', '#c4b5fd', '#f9a8d4', '#a5f3fc', '#fef08a', '#bbf7d0', '#ddd6fe']

// ── Component ─────────────────────────────────────────────────────────────────

const POST_IT_COLORS = ['#fef9c3', '#86efac', '#93c5fd', '#fca5a5', '#fdba74', '#c4b5fd', '#f9a8d4', '#a5f3fc']

interface Props {
  darkMode: boolean
  postIts?: PostIt[]
  documents?: TextDocument[]
  sheets?: Spreadsheet[]
  onCreateDoc?: (subjectId: string) => void
  onCreateSheet?: (subjectId: string) => void
  onOpenDoc?: (docId: string) => void
  onOpenSheet?: (sheetId: string) => void
  onCreatePostIt?: (partial: Partial<PostIt>) => void
}

export default function StudyCenterTab({
  darkMode, postIts = [], documents = [], sheets = [],
  onCreateDoc, onCreateSheet, onOpenDoc, onOpenSheet, onCreatePostIt,
}: Props) {
  const bg = darkMode ? '#161210' : '#f5ede0'
  const card = darkMode ? '#1e1a16' : '#fff'
  const border = darkMode ? '#2e2820' : '#e8d5b7'
  const text = darkMode ? '#f0e6d3' : '#2d1a0a'
  const sub = darkMode ? '#8a7a6a' : '#9a7a5a'
  const accent = '#e07b39'
  const cardBorder = `1.5px solid ${border}`

  // ── Persisted state ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<StudyProfile>(() => ls('study-profile-v1', SEED_PROFILE))
  const [subjects, setSubjects] = useState<StudySubject[]>(() => ls('study-subjects-v1', SEED_SUBJECTS))
  const [sessions, setSessions] = useState<StudySession[]>(() => ls('study-sessions-v1', SEED_SESSIONS))
  const [goals, setGoals] = useState<StudyGoal[]>(() => ls('study-goals-v1', SEED_GOALS))
  const [challenges, setChallenges] = useState<Challenge[]>(() => ls('study-challenges-v1', INITIAL_CHALLENGES))

  useEffect(() => { lsSave('study-profile-v1', profile) }, [profile])
  useEffect(() => { lsSave('study-subjects-v1', subjects) }, [subjects])
  useEffect(() => { lsSave('study-sessions-v1', sessions) }, [sessions])
  useEffect(() => { lsSave('study-goals-v1', goals) }, [goals])
  useEffect(() => { lsSave('study-challenges-v1', challenges) }, [challenges])

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>('overview')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)

  // ── Level-up modal ───────────────────────────────────────────────────────────
  const [levelUpModal, setLevelUpModal] = useState<{ level: number; name: string; icon: string } | null>(null)

  // ── Daily login + streak ─────────────────────────────────────────────────────
  useEffect(() => {
    const today = todayStr()
    setProfile((p) => {
      if (p.lastActiveDate === today) return p // already logged today
      const dates = Array.from(new Set([...p.loginDates, today]))
      // streak calc
      let streak = 1
      const sorted = dates.slice().sort().reverse()
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1])
        const cur = new Date(sorted[i])
        const diff = Math.round((prev.getTime() - cur.getTime()) / 86400000)
        if (diff === 1) streak++
        else break
      }
      const newXp = p.xp + XP_VALUES.daily_login
      const hadStreak7 = p.streak < 7 && streak >= 7
      const finalXp = hadStreak7 ? newXp + XP_VALUES.weekly_streak_7 : newXp
      return { ...p, xp: finalXp, streak, bestStreak: Math.max(p.bestStreak, streak), lastActiveDate: today, loginDates: dates }
    })
  }, [])

  // ── XP award + level-up detection ────────────────────────────────────────────
  const awardXP = useCallback((amount: number) => {
    const oldLevel = getLevel(profile.xp).cur.level
    const newXp = profile.xp + amount
    const newLevel = getLevel(newXp).cur
    setProfile((p) => ({ ...p, xp: p.xp + amount }))
    if (newLevel.level > oldLevel) {
      setLevelUpModal({ level: newLevel.level, name: newLevel.name, icon: newLevel.icon })
    }
  }, [profile.xp])

  // ── Computed values ───────────────────────────────────────────────────────────
  const { cur: curLevel, nxt: nxtLevel } = useMemo(() => getLevel(profile.xp), [profile.xp])
  const xpForNext = nxtLevel.xp - curLevel.xp
  const xpProgress = profile.xp - curLevel.xp
  const xpPct = nxtLevel.level === curLevel.level ? 100 : Math.round((xpProgress / xpForNext) * 100)

  const today = todayStr()
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10) })()
  const monthStart = new Date().toISOString().slice(0, 7) + '-01'

  const todayMins = useMemo(() => sessions.filter((s) => s.startedAt.slice(0, 10) === today).reduce((a, s) => a + s.minutesStudied, 0), [sessions, today])
  const weekMins = useMemo(() => sessions.filter((s) => s.startedAt.slice(0, 10) >= weekStart).reduce((a, s) => a + s.minutesStudied, 0), [sessions, weekStart])
  const monthMins = useMemo(() => sessions.filter((s) => s.startedAt.slice(0, 10) >= monthStart).reduce((a, s) => a + s.minutesStudied, 0), [sessions, monthStart])

  // Last 7 days bar chart data
  const weekBars = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const ds = d.toISOString().slice(0, 10)
    const mins = sessions.filter((s) => s.startedAt.slice(0, 10) === ds).reduce((a, s) => a + s.minutesStudied, 0)
    return { day: WEEKDAYS[d.getDay()], mins, ds }
  }), [sessions])

  const maxBarMins = useMemo(() => Math.max(...weekBars.map((b) => b.mins), 1), [weekBars])

  // ── Subjects ─────────────────────────────────────────────────────────────────
  const [addingSubject, setAddingSubject] = useState(false)
  const [subjectForm, setSubjectForm] = useState({ name: '', color: '#93c5fd', icon: '📘', description: '', professor: '', semester: '', hoursGoal: '40' })

  const saveSubject = () => {
    if (!subjectForm.name.trim()) return
    const s: StudySubject = {
      id: Math.random().toString(36).slice(2),
      name: subjectForm.name.trim(),
      color: subjectForm.color,
      icon: subjectForm.icon,
      description: subjectForm.description.trim() || undefined,
      professor: subjectForm.professor.trim() || undefined,
      semester: subjectForm.semester.trim() || undefined,
      hoursGoal: parseInt(subjectForm.hoursGoal) || 40,
      minutesStudied: 0,
      sessions: 0,
      createdAt: new Date().toISOString(),
    }
    setSubjects((prev) => [...prev, s])
    setSubjectForm({ name: '', color: '#93c5fd', icon: '📘', description: '', professor: '', semester: '', hoursGoal: '40' })
    setAddingSubject(false)
  }

  const deleteSubject = (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id))
    if (selectedSubjectId === id) { setSelectedSubjectId(null); setScreen('subjects') }
  }

  // ── Subject detail: inline post-it creation ───────────────────────────────────
  const [creatingPostIt, setCreatingPostIt] = useState(false)
  const [postItForm, setPostItForm] = useState({ title: '', color: '#fef9c3', dueDate: '' })

  const commitPostIt = (subjectName: string) => {
    if (!postItForm.title.trim()) return
    onCreatePostIt?.({
      title: postItForm.title.trim(),
      color: postItForm.color,
      dueDate: postItForm.dueDate || undefined,
      description: `Matéria: ${subjectName}`,
    })
    setPostItForm({ title: '', color: '#fef9c3', dueDate: '' })
    setCreatingPostIt(false)
  }

  // ── Subject detail tab ───────────────────────────────────────────────────────
  const [detailTab, setDetailTab] = useState<'overview' | 'caderno' | 'postits'>('overview')

  // ── Pomodoro state ────────────────────────────────────────────────────────────
  const [pomPreset, setPomPreset] = useState<PomPreset>('classic')
  const [pomCustom, setPomCustom] = useState({ study: 25, short: 5, long: 15, sessions: 4 })
  const [pomPhase, setPomPhase] = useState<'config' | 'running' | 'paused' | 'break' | 'done'>('config')
  const [pomTimeLeft, setPomTimeLeft] = useState(0)
  const [pomTotalTime, setPomTotalTime] = useState(0)
  const [pomSessionsDone, setPomSessionsDone] = useState(0)
  const [pomSelectedSubjectId, setPomSelectedSubjectId] = useState<string>(subjects[0]?.id ?? '')
  useEffect(() => {
    if (!pomSelectedSubjectId && subjects.length > 0) setPomSelectedSubjectId(subjects[0].id)
  }, [subjects, pomSelectedSubjectId])
  const [pomXpGained, setPomXpGained] = useState(0)
  const pomSessionStart = useRef('')

  const pomConfig = useMemo(() => {
    const preset = POM_PRESETS.find((p) => p.key === pomPreset)!
    if (pomPreset === 'custom') return { study: pomCustom.study, short: pomCustom.short, long: pomCustom.long, sessions: pomCustom.sessions, label: 'Personalizado' }
    return { study: preset.study, short: preset.short, long: preset.long, sessions: preset.sessions, label: preset.label }
  }, [pomPreset, pomCustom])

  const pomSubject = useMemo(() => subjects.find((s) => s.id === pomSelectedSubjectId) ?? subjects[0], [subjects, pomSelectedSubjectId])

  const startPom = () => {
    pomSessionStart.current = new Date().toISOString()
    const totalSecs = pomConfig.study * 60
    setPomTotalTime(totalSecs)
    setPomTimeLeft(totalSecs)
    setPomPhase('running')
  }

  const handlePomComplete = useCallback(() => {
    const mins = pomConfig.study
    const subj = pomSubject
    if (subj) {
      const session: StudySession = {
        id: Math.random().toString(36).slice(2),
        subjectId: subj.id,
        subjectName: subj.name,
        subjectColor: subj.color,
        subjectIcon: subj.icon,
        minutesStudied: mins,
        startedAt: pomSessionStart.current,
        finishedAt: new Date().toISOString(),
        preset: pomConfig.label,
      }
      setSessions((prev) => [...prev, session])
      setSubjects((prev) => prev.map((s) => s.id === subj.id ? { ...s, minutesStudied: s.minutesStudied + mins, sessions: s.sessions + 1 } : s))
      setProfile((p) => ({ ...p, totalMinutesStudied: p.totalMinutesStudied + mins, totalSessions: p.totalSessions + 1 }))
    }
    const xp = XP_VALUES.study_session_complete
    awardXP(xp)
    setPomXpGained(xp)
    setPomSessionsDone((n) => n + 1)
    setPomPhase('done')
  }, [pomConfig, pomSubject, awardXP])

  const pausedFromPhaseRef = useRef<'running' | 'break'>('running')
  const pomHandlerRef = useRef(handlePomComplete)
  useEffect(() => { pomHandlerRef.current = handlePomComplete })

  useEffect(() => {
    if (pomPhase !== 'running' && pomPhase !== 'break') return
    if (pomTimeLeft <= 0) {
      if (pomPhase === 'running') pomHandlerRef.current()
      else { setPomPhase('config') }
      return
    }
    const t = setInterval(() => setPomTimeLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [pomPhase, pomTimeLeft])

  const startBreak = () => {
    const isLong = (pomSessionsDone % pomConfig.sessions) === 0 && pomSessionsDone > 0
    const breakMins = isLong ? pomConfig.long : pomConfig.short
    setPomTotalTime(breakMins * 60)
    setPomTimeLeft(breakMins * 60)
    setPomPhase('break')
  }

  // ── Goals ────────────────────────────────────────────────────────────────────
  const [editGoalId, setEditGoalId] = useState<string | null>(null)
  const [goalInputs, setGoalInputs] = useState<Record<string, string>>({})

  const goalCurrentMins = (g: StudyGoal) => {
    if (g.type === 'daily') return todayMins
    if (g.type === 'weekly') return weekMins
    return monthMins
  }

  // ── History filter ────────────────────────────────────────────────────────────
  const [histFilter, setHistFilter] = useState<'today' | 'week' | 'month' | 'all'>('week')
  const [histSubjectFilter, setHistSubjectFilter] = useState<string>('all')

  const filteredSessions = useMemo(() => {
    let cutoff = ''
    if (histFilter === 'today') cutoff = today
    else if (histFilter === 'week') cutoff = weekStart
    else if (histFilter === 'month') cutoff = monthStart
    return sessions
      .filter((s) => !cutoff || s.startedAt.slice(0, 10) >= cutoff)
      .filter((s) => histSubjectFilter === 'all' || s.subjectId === histSubjectFilter)
      .slice()
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }, [sessions, histFilter, histSubjectFilter, today, weekStart, monthStart])

  // Group by date
  const groupedSessions = useMemo(() => {
    const groups = new Map<string, StudySession[]>()
    for (const s of filteredSessions) {
      const ds = s.startedAt.slice(0, 10)
      if (!groups.has(ds)) groups.set(ds, [])
      groups.get(ds)!.push(s)
    }
    return groups
  }, [filteredSessions])

  // ── Subject detail linked content ────────────────────────────────────────────
  const linkedPostIts = useMemo(() => {
    const subj = subjects.find((s) => s.id === selectedSubjectId)
    if (!subj) return []
    return postIts.filter((p) => !p.deleted && p.title.toLowerCase().includes(subj.name.toLowerCase()))
  }, [postIts, subjects, selectedSubjectId])

  const subjectDocs = useMemo(() =>
    documents.filter((d) => d.subjectId === selectedSubjectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  , [documents, selectedSubjectId])

  const subjectSheets = useMemo(() =>
    sheets.filter((sh) => sh.subjectId === selectedSubjectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  , [sheets, selectedSubjectId])

  const selectedSubject = useMemo(() => subjects.find((s) => s.id === selectedSubjectId), [subjects, selectedSubjectId])

  // ── Render helpers ────────────────────────────────────────────────────────────

  const inputStyle = {
    background: darkMode ? '#252018' : '#fef9f3',
    border: `1.5px solid ${border}`,
    color: text,
    fontFamily: 'Outfit, sans-serif',
    borderRadius: 10,
    outline: 'none',
    padding: '7px 12px',
    fontSize: 13,
    width: '100%',
  }

  const sectionTitle = (t: string) => (
    <h2 className="text-sm font-black mb-4" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>{t}</h2>
  )

  const statCard = (icon: string, label: string, value: string, color = accent) => (
    <div className="flex-1 min-w-0 rounded-2xl px-4 py-4" style={{ background: card, border: cardBorder }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span className="text-[11px] font-semibold" style={{ color: sub, fontFamily: 'Outfit, sans-serif' }}>{label}</span>
      </div>
      <p className="text-xl font-black" style={{ color, fontFamily: 'Nunito, sans-serif' }}>{value}</p>
    </div>
  )

  // ── Views ────────────────────────────────────────────────────────────────────

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="flex gap-3 flex-wrap">
        {statCard('🔥', 'Sequência', `${profile.streak} dias`)}
        {statCard('⏱️', 'Total estudado', formatMins(profile.totalMinutesStudied), '#3b82f6')}
        {statCard('🎯', 'Sessões', `${profile.totalSessions}`, '#22c55e')}
        {statCard('⭐', curLevel.name, `Nível ${curLevel.level}`, '#f59e0b')}
      </div>

      {/* XP bar */}
      <div className="rounded-2xl p-4" style={{ background: card, border: cardBorder }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 22 }}>{curLevel.icon}</span>
            <div>
              <p className="font-black text-sm" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>Nível {curLevel.level} — {curLevel.name}</p>
              <p className="text-[11px]" style={{ color: sub }}>{profile.xp.toLocaleString()} XP</p>
            </div>
          </div>
          {curLevel.level < 9 && (
            <p className="text-xs font-semibold" style={{ color: sub }}>{(nxtLevel.xp - profile.xp).toLocaleString()} XP para nível {nxtLevel.level}</p>
          )}
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: darkMode ? '#2e2820' : '#f0e6d3' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg, ${accent}, #f59e0b)` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px]" style={{ color: sub }}>{xpProgress.toLocaleString()} XP</span>
          {curLevel.level < 9 && <span className="text-[10px]" style={{ color: sub }}>{xpForNext.toLocaleString()} XP</span>}
        </div>
      </div>

      {/* Estudar agora */}
      <div className="rounded-2xl p-5" style={{ background: card, border: cardBorder }}>
        <h3 className="text-sm font-black mb-3" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>Estudar agora</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: sub }}>Matéria</label>
            <select
              value={pomSelectedSubjectId}
              onChange={(e) => setPomSelectedSubjectId(e.target.value)}
              style={{ ...inputStyle, padding: '8px 12px' }}
            >
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-32">
            <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: sub }}>Modo</label>
            <select
              value={pomPreset}
              onChange={(e) => setPomPreset(e.target.value as PomPreset)}
              style={{ ...inputStyle, padding: '8px 12px' }}
            >
              {POM_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
            </select>
          </div>
          <button
            onClick={() => { setScreen('pomodoro'); startPom() }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all"
            style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Iniciar estudo
          </button>
        </div>
      </div>

      {/* Streak calendar */}
      <div className="rounded-2xl p-4" style={{ background: card, border: cardBorder }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>Sequência de atividade</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold" style={{ color: accent }}>🔥 {profile.streak} dias</span>
            <span className="text-xs" style={{ color: sub }}>Recorde: {profile.bestStreak} dias</span>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: 28 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (27 - i))
            const ds = d.toISOString().slice(0, 10)
            const active = profile.loginDates.includes(ds)
            const isToday = ds === today
            return (
              <div key={i} title={ds} className="w-6 h-6 rounded-md" style={{
                background: active ? (isToday ? accent : darkMode ? 'rgba(224,123,57,0.45)' : 'rgba(224,123,57,0.35)') : (darkMode ? '#252018' : '#f0e6d3'),
                border: isToday ? `1.5px solid ${accent}` : '1.5px solid transparent',
              }} />
            )
          })}
        </div>
      </div>

      {/* Goals quick view */}
      <div className="rounded-2xl p-4" style={{ background: card, border: cardBorder }}>
        <h3 className="text-sm font-black mb-3" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>Progresso das metas</h3>
        <div className="space-y-3">
          {goals.map((g) => {
            const cur = goalCurrentMins(g)
            const pct = Math.min(100, Math.round((cur / g.targetMinutes) * 100))
            const done = cur >= g.targetMinutes
            return (
              <div key={g.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: text, fontFamily: 'Outfit, sans-serif' }}>{g.label}</span>
                  <span className="text-xs font-bold" style={{ color: done ? '#22c55e' : sub }}>{formatMins(cur)} / {formatMins(g.targetMinutes)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: darkMode ? '#2e2820' : '#f0e6d3' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? '#22c55e' : accent }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const renderSubjects = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        {sectionTitle('Minhas matérias')}
        <button
          onClick={() => setAddingSubject(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
          style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nova matéria
        </button>
      </div>

      {/* Add form */}
      {addingSubject && (
        <div className="rounded-2xl p-4 mb-4 space-y-3" style={{ background: card, border: cardBorder }}>
          <p className="text-sm font-black" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>Nova matéria</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: sub }}>Nome *</label>
              <input value={subjectForm.name} onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Banco de Dados" style={inputStyle} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: sub }}>Meta de horas</label>
              <input type="number" value={subjectForm.hoursGoal} onChange={(e) => setSubjectForm((f) => ({ ...f, hoursGoal: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: sub }}>Professor</label>
              <input value={subjectForm.professor} onChange={(e) => setSubjectForm((f) => ({ ...f, professor: e.target.value }))} placeholder="Opcional" style={inputStyle} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: sub }}>Semestre</label>
              <input value={subjectForm.semester} onChange={(e) => setSubjectForm((f) => ({ ...f, semester: e.target.value }))} placeholder="Ex: 4º Semestre" style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: sub }}>Descrição</label>
            <input value={subjectForm.description} onChange={(e) => setSubjectForm((f) => ({ ...f, description: e.target.value }))} placeholder="Opcional" style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide block mb-1.5" style={{ color: sub }}>Ícone</label>
            <div className="flex gap-1.5 flex-wrap">
              {SUBJECT_ICONS.map((ic) => (
                <button key={ic} onClick={() => setSubjectForm((f) => ({ ...f, icon: ic }))}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all"
                  style={{ background: subjectForm.icon === ic ? accent : (darkMode ? '#252018' : '#f0e6d3'), border: subjectForm.icon === ic ? `2px solid ${accent}` : '2px solid transparent' }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide block mb-1.5" style={{ color: sub }}>Cor</label>
            <div className="flex gap-1.5 flex-wrap">
              {SUBJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setSubjectForm((f) => ({ ...f, color: c }))}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                  style={{ background: c, border: subjectForm.color === c ? '2px solid #2d1a0a' : '2px solid transparent' }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={saveSubject} disabled={!subjectForm.name.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-40 hover:opacity-90 transition-opacity"
              style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>Criar matéria</button>
            <button onClick={() => setAddingSubject(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-80"
              style={{ background: darkMode ? '#2e2820' : '#f0e6d3', color: sub }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Subject cards */}
      <div className="grid grid-cols-2 gap-3">
        {subjects.map((s) => {
          const pct = Math.min(100, Math.round((s.minutesStudied / (s.hoursGoal * 60)) * 100))
          return (
            <button key={s.id} onClick={() => { setSelectedSubjectId(s.id); setScreen('subject-detail') }}
              className="text-left rounded-2xl p-4 transition-all hover:shadow-md group"
              style={{ background: card, border: cardBorder }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <p className="font-bold text-sm leading-tight" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>{s.name}</p>
                    {s.semester && <p className="text-[10px]" style={{ color: sub }}>{s.semester}</p>}
                  </div>
                </div>
                <div className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ background: s.color }} />
              </div>
              <p className="text-xs font-semibold mb-2" style={{ color: sub }}>{formatMins(s.minutesStudied)} estudados</p>
              <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: darkMode ? '#2e2820' : '#f0e6d3' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: sub }}>{s.sessions} sessões</span>
                <span className="text-[10px] font-bold" style={{ color: s.color }}>{pct}%</span>
              </div>
            </button>
          )
        })}
      </div>

      {subjects.length === 0 && !addingSubject && (
        <div className="text-center py-16">
          <span style={{ fontSize: 48 }}>📚</span>
          <p className="mt-3 font-semibold text-sm" style={{ color: sub }}>Nenhuma matéria ainda</p>
          <p className="text-xs mt-1" style={{ color: sub }}>Crie sua primeira matéria para começar a acompanhar seus estudos.</p>
        </div>
      )}
    </div>
  )

  const renderSubjectDetail = () => {
    const s = selectedSubject
    if (!s) return null
    const pct = Math.min(100, Math.round((s.minutesStudied / (s.hoursGoal * 60)) * 100))
    const subSessions = sessions.filter((ss) => ss.subjectId === s.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 8)

    const tabBtn = (key: typeof detailTab, label: string) => (
      <button key={key} onClick={() => setDetailTab(key)}
        className="px-4 py-1.5 text-xs font-bold rounded-xl transition-all"
        style={{
          background: detailTab === key ? accent : 'transparent',
          color: detailTab === key ? '#fff' : sub,
          fontFamily: 'Nunito, sans-serif',
        }}>
        {label}
      </button>
    )

    return (
      <div>
        {/* Back */}
        <button onClick={() => { setScreen('subjects'); setSelectedSubjectId(null); setDetailTab('overview') }}
          className="flex items-center gap-1.5 text-xs font-semibold mb-4 hover:opacity-70 transition-opacity"
          style={{ color: sub, fontFamily: 'Nunito, sans-serif' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Minhas matérias
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="text-4xl">{s.icon}</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black leading-tight" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>{s.name}</h2>
            {s.description && <p className="text-xs mt-0.5" style={{ color: sub }}>{s.description}</p>}
            <div className="flex gap-3 mt-1 flex-wrap">
              {s.professor && <span className="text-[10px]" style={{ color: sub }}>👤 {s.professor}</span>}
              {s.semester && <span className="text-[10px]" style={{ color: sub }}>📅 {s.semester}</span>}
            </div>
          </div>
          <button onClick={() => deleteSubject(s.id)}
            className="p-2 rounded-xl hover:bg-red-500/10 transition-colors shrink-0"
            style={{ color: '#ef4444' }} title="Excluir matéria">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>

        {/* Quick stats strip */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: card, border: cardBorder }}>
            <p className="text-base font-black" style={{ color: accent, fontFamily: 'Nunito, sans-serif' }}>{formatMins(s.minutesStudied)}</p>
            <p className="text-[10px]" style={{ color: sub }}>Estudados</p>
          </div>
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: card, border: cardBorder }}>
            <p className="text-base font-black" style={{ color: '#3b82f6', fontFamily: 'Nunito, sans-serif' }}>{s.sessions}</p>
            <p className="text-[10px]" style={{ color: sub }}>Sessões</p>
          </div>
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: card, border: cardBorder }}>
            <p className="text-base font-black" style={{ color: '#22c55e', fontFamily: 'Nunito, sans-serif' }}>{pct}%</p>
            <p className="text-[10px]" style={{ color: sub }}>Meta</p>
          </div>
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: card, border: cardBorder }}>
            <p className="text-base font-black" style={{ color: '#a78bfa', fontFamily: 'Nunito, sans-serif' }}>{subjectDocs.length + subjectSheets.length}</p>
            <p className="text-[10px]" style={{ color: sub }}>Arquivos</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-5 rounded-2xl p-3" style={{ background: card, border: cardBorder }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: text }}>Progresso da meta</span>
            <span className="text-xs font-bold" style={{ color: s.color }}>{formatMins(s.minutesStudied)} / {s.hoursGoal}h</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: darkMode ? '#2e2820' : '#f0e6d3' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
          </div>
        </div>

        {/* Start session */}
        <button
          onClick={() => { setPomSelectedSubjectId(s.id); setScreen('pomodoro'); startPom() }}
          className="w-full py-2.5 rounded-xl font-bold text-sm mb-5 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
          style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Iniciar sessão de estudo
        </button>

        {/* Internal tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: darkMode ? '#252018' : '#f0e6d3' }}>
          {tabBtn('overview', '📊 Visão geral')}
          {tabBtn('caderno', `📓 Caderno (${subjectDocs.length + subjectSheets.length})`)}
          {tabBtn('postits', `📌 Post-its (${linkedPostIts.length})`)}
        </div>

        {/* ── Overview tab ────────────────────────────────────────────────── */}
        {detailTab === 'overview' && (
          <div className="space-y-4">
            {subSessions.length > 0 ? (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: sub }}>Sessões recentes</h3>
                <div className="space-y-2">
                  {subSessions.map((ss) => (
                    <div key={ss.id} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: card, border: cardBorder }}>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: text }}>{ss.preset}</p>
                        <p className="text-[10px]" style={{ color: sub }}>{new Date(ss.startedAt).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                      </div>
                      <span className="text-xs font-bold" style={{ color: accent }}>{formatMins(ss.minutesStudied)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <span style={{ fontSize: 40 }}>⏱️</span>
                <p className="mt-2 text-sm font-semibold" style={{ color: sub }}>Nenhuma sessão ainda</p>
                <p className="text-xs mt-1" style={{ color: sub }}>Inicie sua primeira sessão de estudo!</p>
              </div>
            )}
          </div>
        )}

        {/* ── Caderno tab ─────────────────────────────────────────────────── */}
        {detailTab === 'caderno' && (
          <div className="space-y-5">
            {/* Documents */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: sub }}>📄 Documentos</h3>
                <button onClick={() => onCreateDoc?.(s.id)}
                  className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg hover:opacity-80 transition-opacity"
                  style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Novo documento
                </button>
              </div>
              {subjectDocs.length === 0 ? (
                <button onClick={() => onCreateDoc?.(s.id)}
                  className="w-full flex flex-col items-center justify-center py-8 rounded-2xl transition-opacity hover:opacity-70"
                  style={{ border: `1.5px dashed ${border}`, background: darkMode ? '#252018' : '#fef9f3' }}>
                  <span style={{ fontSize: 32 }}>📄</span>
                  <p className="text-xs font-semibold mt-2" style={{ color: sub }}>Criar primeiro documento</p>
                </button>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {subjectDocs.map((d) => (
                    <button key={d.id} onClick={() => onOpenDoc?.(d.id)}
                      className="text-left p-3 rounded-2xl transition-all hover:shadow-md group"
                      style={{ background: card, border: cardBorder }}>
                      <div className="flex items-start justify-between mb-2">
                        <span style={{ fontSize: 24 }}>📄</span>
                        <div className="w-1.5 h-1.5 rounded-full mt-1" style={{ background: s.color }} />
                      </div>
                      <p className="text-xs font-bold leading-snug truncate" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>{d.title}</p>
                      <p className="text-[10px] mt-1" style={{ color: sub }}>
                        {new Date(d.updatedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Spreadsheets */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: sub }}>📊 Planilhas</h3>
                <button onClick={() => onCreateSheet?.(s.id)}
                  className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg hover:opacity-80 transition-opacity"
                  style={{ background: '#22c55e', color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Nova planilha
                </button>
              </div>
              {subjectSheets.length === 0 ? (
                <button onClick={() => onCreateSheet?.(s.id)}
                  className="w-full flex flex-col items-center justify-center py-8 rounded-2xl transition-opacity hover:opacity-70"
                  style={{ border: `1.5px dashed ${border}`, background: darkMode ? '#252018' : '#fef9f3' }}>
                  <span style={{ fontSize: 32 }}>📊</span>
                  <p className="text-xs font-semibold mt-2" style={{ color: sub }}>Criar primeira planilha</p>
                </button>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {subjectSheets.map((sh) => (
                    <button key={sh.id} onClick={() => onOpenSheet?.(sh.id)}
                      className="text-left p-3 rounded-2xl transition-all hover:shadow-md"
                      style={{ background: card, border: cardBorder }}>
                      <div className="flex items-start justify-between mb-2">
                        <span style={{ fontSize: 24 }}>📊</span>
                        <div className="w-1.5 h-1.5 rounded-full mt-1" style={{ background: '#22c55e' }} />
                      </div>
                      <p className="text-xs font-bold leading-snug truncate" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>{sh.title}</p>
                      <p className="text-[10px] mt-1" style={{ color: sub }}>
                        {new Date(sh.updatedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Post-its tab ────────────────────────────────────────────────── */}
        {detailTab === 'postits' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: sub }}>Post-its da matéria</h3>
              <button onClick={() => setCreatingPostIt(true)}
                className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg hover:opacity-80 transition-opacity"
                style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Criar post-it
              </button>
            </div>

            {/* Inline creation form */}
            {creatingPostIt && (
              <div className="rounded-2xl p-4 mb-4 space-y-3" style={{ background: card, border: cardBorder }}>
                <p className="text-xs font-black" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>Novo post-it — {s.name}</p>
                <input
                  autoFocus
                  value={postItForm.title}
                  onChange={(e) => setPostItForm((f) => ({ ...f, title: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitPostIt(s.name); if (e.key === 'Escape') setCreatingPostIt(false) }}
                  placeholder="Título do post-it…"
                  style={{ ...inputStyle }}
                />
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide block mb-1.5" style={{ color: sub }}>Data de entrega</label>
                  <input type="date" value={postItForm.dueDate} onChange={(e) => setPostItForm((f) => ({ ...f, dueDate: e.target.value }))} style={{ ...inputStyle, width: 'auto' }} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide block mb-1.5" style={{ color: sub }}>Cor</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {POST_IT_COLORS.map((c) => (
                      <button key={c} onClick={() => setPostItForm((f) => ({ ...f, color: c }))}
                        className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                        style={{ background: c, border: postItForm.color === c ? '2px solid #2d1a0a' : '2px solid transparent' }} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => commitPostIt(s.name)} disabled={!postItForm.title.trim()}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
                    style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
                    Criar
                  </button>
                  <button onClick={() => setCreatingPostIt(false)}
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: darkMode ? '#2e2820' : '#f0e6d3', color: sub }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {linkedPostIts.length === 0 && !creatingPostIt ? (
              <div className="text-center py-10">
                <span style={{ fontSize: 40 }}>📌</span>
                <p className="mt-2 text-sm font-semibold" style={{ color: sub }}>Nenhum post-it ainda</p>
                <p className="text-xs mt-1 mb-4" style={{ color: sub }}>Post-its com o nome "{s.name}" aparecem aqui automaticamente.</p>
                <button onClick={() => setCreatingPostIt(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90"
                  style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
                  Criar primeiro post-it
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {linkedPostIts.map((p) => (
                  <div key={p.id} className="p-3 rounded-2xl" style={{ background: p.color }}>
                    <p className="text-xs font-bold leading-snug mb-1" style={{ color: '#1a0f00', fontFamily: 'Kalam, cursive', textDecoration: p.completed ? 'line-through' : 'none', opacity: p.completed ? 0.6 : 1 }}>{p.title}</p>
                    {p.description && <p className="text-[10px] mb-1" style={{ color: '#5a3e28', fontFamily: 'Outfit, sans-serif' }}>{p.description}</p>}
                    <div className="flex items-center justify-between">
                      {p.dueDate && <span className="text-[9px]" style={{ color: '#7a5c3c' }}>📅 {new Date(p.dueDate + 'T12:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>}
                      <span className="text-[9px] font-bold ml-auto" style={{ color: p.completed ? '#22c55e' : '#7a5c3c' }}>{p.completed ? '✓ Feita' : '○ Pendente'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderPomodoro = () => {
    const preset = POM_PRESETS.find((p) => p.key === pomPreset)!
    const progress = pomTotalTime > 0 ? pomTimeLeft / pomTotalTime : 1
    const r = 54
    const circ = 2 * Math.PI * r
    const offset = circ * (1 - progress)
    const timerDanger = pomTimeLeft <= 60 && pomPhase === 'running'
    const timerColor = pomPhase === 'break' ? '#22c55e' : timerDanger ? '#ef4444' : accent

    if (pomPhase === 'done') {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12">
          <span style={{ fontSize: 56 }}>🎉</span>
          <h2 className="text-2xl font-black mt-4 mb-1" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>Sessão concluída!</h2>
          <p className="text-sm mb-6" style={{ color: sub }}>Você estudou {pomConfig.study} minutos</p>
          <div className="rounded-2xl px-8 py-4 mb-6 text-center" style={{ background: card, border: cardBorder }}>
            <p className="text-4xl font-black" style={{ color: accent, fontFamily: 'Nunito, sans-serif' }}>{formatMins(pomConfig.study)}</p>
            <p className="text-xs mt-1 font-semibold" style={{ color: sub }}>{pomSubject?.name ?? ''}</p>
            <p className="text-sm font-bold mt-3" style={{ color: '#f59e0b' }}>+{pomXpGained} XP</p>
            <p className="text-[10px] mt-0.5" style={{ color: sub }}>Sessão {pomSessionsDone} concluída</p>
          </div>
          <div className="flex gap-3">
            <button onClick={startBreak}
              className="px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
              style={{ background: '#22c55e', color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
              ☕ Pausa
            </button>
            <button onClick={() => { setPomPhase('config') }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-80 transition-opacity"
              style={{ background: darkMode ? '#2e2820' : '#f0e6d3', color: sub, fontFamily: 'Nunito, sans-serif' }}>
              Finalizar
            </button>
            <button onClick={startPom}
              className="px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
              style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
              Nova sessão
            </button>
          </div>
        </div>
      )
    }

    if (pomPhase === 'running' || pomPhase === 'paused' || pomPhase === 'break') {
      return (
        <div className="flex flex-col items-center justify-center h-full py-8">
          <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: sub }}>
            {pomPhase === 'break' ? '☕ PAUSA' : `⏱️ FOCO — ${pomSubject?.name ?? ''}`}
          </p>

          {/* Circular timer */}
          <div className="relative mb-6">
            <svg width="148" height="148" viewBox="0 0 148 148">
              <circle cx="74" cy="74" r={r} fill="none" stroke={darkMode ? '#2e2820' : '#f0e6d3'} strokeWidth="8" />
              <circle cx="74" cy="74" r={r} fill="none"
                stroke={timerColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                transform="rotate(-90 74 74)"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black tabular-nums" style={{ color: timerColor, fontFamily: 'Nunito, sans-serif' }}>{formatSecs(pomTimeLeft)}</span>
              <span className="text-xs font-semibold mt-0.5" style={{ color: sub }}>{pomPhase === 'break' ? 'Descanse' : 'Foco'}</span>
            </div>
          </div>

          <p className="text-sm font-semibold mb-1" style={{ color: text }}>{pomPreset !== 'custom' ? preset.label : 'Personalizado'}</p>
          <p className="text-xs mb-8" style={{ color: sub }}>Sessão {pomSessionsDone + 1}</p>

          <div className="flex gap-3">
            {pomPhase === 'paused' ? (
              <button onClick={() => setPomPhase(pausedFromPhaseRef.current)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
                style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Continuar
              </button>
            ) : (
              <button onClick={() => { pausedFromPhaseRef.current = pomPhase as 'running' | 'break'; setPomPhase('paused') }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
                style={{ background: darkMode ? '#2e2820' : '#f0e6d3', color: text, fontFamily: 'Nunito, sans-serif' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                Pausar
              </button>
            )}
            <button onClick={() => { if (pomPhase === 'break') setPomPhase('config'); else pomHandlerRef.current() }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-80"
              style={{ background: darkMode ? '#2e2820' : '#f0e6d3', color: '#ef4444', fontFamily: 'Nunito, sans-serif' }}>
              Finalizar
            </button>
          </div>
        </div>
      )
    }

    // Config screen
    return (
      <div className="max-w-lg mx-auto">
        {sectionTitle('Sessão de estudo')}

        {/* Presets */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {POM_PRESETS.map((p) => (
            <button key={p.key} onClick={() => setPomPreset(p.key)}
              className="p-3 rounded-2xl text-center transition-all hover:scale-[1.02]"
              style={{
                background: pomPreset === p.key ? (darkMode ? 'rgba(224,123,57,0.15)' : 'rgba(224,123,57,0.08)') : card,
                border: pomPreset === p.key ? `1.5px solid ${accent}` : cardBorder,
              }}>
              <div style={{ fontSize: 22 }}>{p.icon}</div>
              <p className="text-xs font-bold mt-1" style={{ color: pomPreset === p.key ? accent : text, fontFamily: 'Nunito, sans-serif' }}>{p.label}</p>
              {p.key !== 'custom' && <p className="text-[10px] mt-0.5" style={{ color: sub }}>{p.study}min / {p.short}min</p>}
            </button>
          ))}
        </div>

        {/* Config fields */}
        <div className="rounded-2xl p-4 mb-6 space-y-4" style={{ background: card, border: cardBorder }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: sub }}>Tempo de estudo (min)</label>
              <input type="number" min={5} max={180}
                value={pomPreset === 'custom' ? pomCustom.study : POM_PRESETS.find(p => p.key === pomPreset)!.study}
                onChange={(e) => { setPomPreset('custom'); setPomCustom((c) => ({ ...c, study: parseInt(e.target.value) || 25 })) }}
                style={inputStyle} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: sub }}>Pausa curta (min)</label>
              <input type="number" min={1} max={30}
                value={pomPreset === 'custom' ? pomCustom.short : POM_PRESETS.find(p => p.key === pomPreset)!.short}
                onChange={(e) => { setPomPreset('custom'); setPomCustom((c) => ({ ...c, short: parseInt(e.target.value) || 5 })) }}
                style={inputStyle} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: sub }}>Pausa longa (min)</label>
              <input type="number" min={5} max={60}
                value={pomPreset === 'custom' ? pomCustom.long : POM_PRESETS.find(p => p.key === pomPreset)!.long}
                onChange={(e) => { setPomPreset('custom'); setPomCustom((c) => ({ ...c, long: parseInt(e.target.value) || 15 })) }}
                style={inputStyle} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: sub }}>Sessões até pausa longa</label>
              <input type="number" min={1} max={10}
                value={pomPreset === 'custom' ? pomCustom.sessions : POM_PRESETS.find(p => p.key === pomPreset)!.sessions}
                onChange={(e) => { setPomPreset('custom'); setPomCustom((c) => ({ ...c, sessions: parseInt(e.target.value) || 4 })) }}
                style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Subject picker */}
        <div className="mb-6">
          <label className="text-[10px] font-bold uppercase tracking-wide block mb-1.5" style={{ color: sub }}>Matéria</label>
          <select value={pomSelectedSubjectId} onChange={(e) => setPomSelectedSubjectId(e.target.value)} style={{ ...inputStyle, padding: '10px 12px' }}>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
          {subjects.length === 0 && <p className="text-xs mt-1" style={{ color: sub }}>Crie uma matéria primeiro.</p>}
        </div>

        <button
          onClick={startPom}
          disabled={subjects.length === 0}
          className="w-full py-3.5 rounded-2xl font-bold text-base hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
          style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}
        >
          ▶ Iniciar sessão — {pomConfig.study} min
        </button>
      </div>
    )
  }

  const renderHistory = () => {
    const dateLabel = (ds: string) => {
      const today2 = todayStr()
      const yest = new Date(); yest.setDate(yest.getDate() - 1); const yesterdayStr = yest.toISOString().slice(0, 10)
      if (ds === today2) return 'Hoje'
      if (ds === yesterdayStr) return 'Ontem'
      return new Date(ds + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          {sectionTitle('Histórico de estudos')}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-4">
          <div className="flex rounded-xl overflow-hidden" style={{ border: cardBorder }}>
            {(['today', 'week', 'month', 'all'] as const).map((f) => (
              <button key={f} onClick={() => setHistFilter(f)}
                className="px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  background: histFilter === f ? accent : 'transparent',
                  color: histFilter === f ? '#fff' : sub,
                  fontFamily: 'Outfit, sans-serif',
                }}>
                {f === 'today' ? 'Hoje' : f === 'week' ? 'Semana' : f === 'month' ? 'Mês' : 'Tudo'}
              </button>
            ))}
          </div>
          <select value={histSubjectFilter} onChange={(e) => setHistSubjectFilter(e.target.value)}
            style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12 }}>
            <option value="all">Todas as matérias</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
        </div>

        {/* Sessions */}
        {groupedSessions.size === 0 ? (
          <div className="text-center py-16">
            <span style={{ fontSize: 48 }}>📅</span>
            <p className="mt-3 font-semibold text-sm" style={{ color: sub }}>Nenhuma sessão encontrada</p>
          </div>
        ) : (
          <div className="space-y-5">
            {Array.from(groupedSessions.entries()).map(([ds, sss]) => (
              <div key={ds}>
                <p className="text-xs font-bold mb-2 capitalize" style={{ color: sub }}>{dateLabel(ds)}</p>
                <div className="space-y-2">
                  {sss.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: card, border: cardBorder }}>
                      <span style={{ fontSize: 22 }}>{s.subjectIcon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: text, fontFamily: 'Outfit, sans-serif' }}>{s.subjectName}</p>
                        <p className="text-[10px]" style={{ color: sub }}>{s.preset}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: accent }}>{formatMins(s.minutesStudied)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] font-semibold mt-1.5 text-right" style={{ color: sub }}>
                  Total: {formatMins(sss.reduce((a, s) => a + s.minutesStudied, 0))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderGoals = () => (
    <div>
      {sectionTitle('Metas de estudo')}
      <div className="space-y-4">
        {goals.map((g) => {
          const cur = goalCurrentMins(g)
          const pct = Math.min(100, Math.round((cur / g.targetMinutes) * 100))
          const done = cur >= g.targetMinutes
          const isEditing = editGoalId === g.id
          const typeLabel = g.type === 'daily' ? 'Diária' : g.type === 'weekly' ? 'Semanal' : 'Mensal'
          const typeIcon = g.type === 'daily' ? '☀️' : g.type === 'weekly' ? '📅' : '🗓️'

          return (
            <div key={g.id} className="rounded-2xl p-4" style={{ background: card, border: cardBorder }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 20 }}>{typeIcon}</span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>Meta {typeLabel}</p>
                    <p className="text-[10px]" style={{ color: sub }}>Estudar {formatMins(g.targetMinutes)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {done && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>✓ Concluída</span>}
                  <button onClick={() => { setEditGoalId(isEditing ? null : g.id); setGoalInputs((p) => ({ ...p, [g.id]: String(Math.round(g.targetMinutes / 60)) })) }}
                    className="p-1.5 rounded-lg hover:bg-black/8 transition-colors" style={{ color: sub }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="flex gap-2 mb-3">
                  <input type="number" min={1}
                    value={goalInputs[g.id] ?? String(Math.round(g.targetMinutes / 60))}
                    onChange={(e) => setGoalInputs((p) => ({ ...p, [g.id]: e.target.value }))}
                    style={{ ...inputStyle, width: 100 }} />
                  <span className="flex items-center text-xs" style={{ color: sub }}>horas</span>
                  <button
                    onClick={() => {
                      const hrs = parseFloat(goalInputs[g.id] || '1') || 1
                      setGoals((gs) => gs.map((gg) => gg.id === g.id ? { ...gg, targetMinutes: Math.round(hrs * 60) } : gg))
                      setEditGoalId(null)
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{ background: accent, color: '#fff' }}>Salvar</button>
                </div>
              )}

              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xl font-black" style={{ color: done ? '#22c55e' : accent, fontFamily: 'Nunito, sans-serif' }}>{pct}%</span>
                <span className="text-xs font-semibold" style={{ color: sub }}>{formatMins(cur)} / {formatMins(g.targetMinutes)}</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: darkMode ? '#2e2820' : '#f0e6d3' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? '#22c55e' : accent }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderChallenges = () => (
    <div>
      {sectionTitle('Desafios')}
      <div className="space-y-3">
        {challenges.map((c) => {
          const done = !!c.completedAt || c.progress >= c.target
          const pct = Math.min(100, Math.round((c.progress / c.target) * 100))
          return (
            <div key={c.id} className="rounded-2xl p-4" style={{ background: card, border: cardBorder, opacity: done ? 0.75 : 1 }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    {done && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>✓ Concluído</span>}
                    <p className="text-sm font-bold" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>{c.title}</p>
                  </div>
                  <p className="text-xs" style={{ color: sub }}>{c.progress} / {c.target} {c.unit}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <span style={{ fontSize: 14 }}>⭐</span>
                  <span className="text-xs font-bold" style={{ color: '#f59e0b', fontFamily: 'Nunito, sans-serif' }}>+{c.xpReward} XP</span>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: darkMode ? '#2e2820' : '#f0e6d3' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? '#22c55e' : accent }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: sub }}>{pct}% concluído</span>
                {c.completedAt && <span className="text-[10px]" style={{ color: '#22c55e' }}>Concluído em {new Date(c.completedAt).toLocaleDateString('pt-BR')}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderProgress = () => {
    const topSubject = subjects.reduce((a, b) => a.minutesStudied > b.minutesStudied ? a : b, subjects[0])
    const bestDay = weekBars.reduce((a, b) => a.mins > b.mins ? a : b, weekBars[0])

    return (
      <div className="space-y-6">
        {sectionTitle('Meu desempenho')}

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Esta semana', value: formatMins(weekMins), icon: '⏱️', color: accent },
            { label: 'Sessões', value: String(sessions.filter((s) => s.startedAt.slice(0, 10) >= weekStart).length), icon: '🎯', color: '#3b82f6' },
            { label: 'Sequência', value: `${profile.streak}d`, icon: '🔥', color: '#f59e0b' },
            { label: 'XP ganho', value: `${profile.xp}`, icon: '⭐', color: '#a78bfa' },
            { label: 'Total estudado', value: formatMins(profile.totalMinutesStudied), icon: '📚', color: '#22c55e' },
            { label: 'Total sessões', value: String(profile.totalSessions), icon: '⚡', color: '#ec4899' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="rounded-2xl p-3 text-center" style={{ background: card, border: cardBorder }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <p className="text-lg font-black mt-1" style={{ color, fontFamily: 'Nunito, sans-serif' }}>{value}</p>
              <p className="text-[10px]" style={{ color: sub }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="rounded-2xl p-4" style={{ background: card, border: cardBorder }}>
          <h3 className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: sub }}>Horas estudadas por dia (últimos 7 dias)</h3>
          <div className="space-y-2">
            {weekBars.map((b) => (
              <div key={b.ds} className="flex items-center gap-3">
                <span className="text-[11px] font-semibold w-8 shrink-0" style={{ color: sub }}>{b.day}</span>
                <div className="flex-1 h-5 rounded-lg overflow-hidden" style={{ background: darkMode ? '#252018' : '#f0e6d3' }}>
                  {b.mins > 0 && (
                    <div className="h-full rounded-lg flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${(b.mins / maxBarMins) * 100}%`, background: b.ds === today ? accent : (darkMode ? 'rgba(224,123,57,0.45)' : 'rgba(224,123,57,0.4)'), minWidth: b.mins > 0 ? 40 : 0 }}>
                      <span className="text-[10px] font-bold text-white">{formatMins(b.mins)}</span>
                    </div>
                  )}
                </div>
                {b.mins === 0 && <span className="text-[10px]" style={{ color: sub }}>—</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        {subjects.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {topSubject && (
              <div className="rounded-2xl p-4" style={{ background: card, border: cardBorder }}>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: sub }}>Matéria mais estudada</p>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 24 }}>{topSubject.icon}</span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>{topSubject.name}</p>
                    <p className="text-xs" style={{ color: sub }}>{formatMins(topSubject.minutesStudied)}</p>
                  </div>
                </div>
              </div>
            )}
            {bestDay && bestDay.mins > 0 && (
              <div className="rounded-2xl p-4" style={{ background: card, border: cardBorder }}>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: sub }}>Melhor dia da semana</p>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 24 }}>🔥</span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>{WEEKDAYS[new Date(bestDay.ds + 'T12:00:00').getDay()]}-feira</p>
                    <p className="text-xs" style={{ color: sub }}>{formatMins(bestDay.mins)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderAchievements = () => (
    <div>
      {sectionTitle('Conquistas')}
      <div className="grid grid-cols-2 gap-3">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = (profile.achievements ?? []).includes(a.id)
          return (
            <div key={a.id} className="rounded-2xl p-4 transition-all" style={{
              background: card,
              border: unlocked ? `1.5px solid ${accent}` : cardBorder,
              opacity: unlocked ? 1 : 0.5,
            }}>
              <div className="flex items-center gap-3 mb-1">
                <span style={{ fontSize: 28, filter: unlocked ? 'none' : 'grayscale(1)' }}>{a.icon}</span>
                <div>
                  <p className="text-xs font-bold" style={{ color: unlocked ? text : sub, fontFamily: 'Nunito, sans-serif' }}>{a.title}</p>
                  {unlocked && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(224,123,57,0.12)', color: accent }}>Desbloqueado</span>}
                </div>
              </div>
              <p className="text-[10px]" style={{ color: sub }}>{a.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── Level-up modal ────────────────────────────────────────────────────────────

  const renderLevelUpModal = () => {
    if (!levelUpModal) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={() => setLevelUpModal(null)}>
        <div className="rounded-3xl p-8 text-center max-w-xs w-full mx-4"
          style={{ background: card, border: `2px solid ${accent}`, boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}
          onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 60 }}>{levelUpModal.icon}</div>
          <p className="text-xs font-bold uppercase tracking-widest mt-3 mb-1" style={{ color: accent }}>Novo nível!</p>
          <h2 className="text-3xl font-black" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>Nível {levelUpModal.level}</h2>
          <p className="text-lg font-bold mt-1 mb-6" style={{ color: sub, fontFamily: 'Nunito, sans-serif' }}>{levelUpModal.name}</p>
          <button onClick={() => setLevelUpModal(null)}
            className="w-full py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity"
            style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
            Continuar 🚀
          </button>
        </div>
      </div>
    )
  }

  // ── Layout ────────────────────────────────────────────────────────────────────

  const activeScreen = screen === 'subject-detail' && selectedSubject ? 'subject-detail' : screen

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden" style={{ background: bg, fontFamily: 'Outfit, sans-serif' }}>
      {renderLevelUpModal()}

      {/* Left nav */}
      <div className="shrink-0 flex flex-col py-4 overflow-y-auto"
        style={{ width: 200, background: darkMode ? '#161210' : '#f0e4cf', borderRight: `1px solid ${border}` }}>

        {/* Header */}
        <div className="px-4 mb-4">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: accent, fontFamily: 'Nunito, sans-serif' }}>📚 Central</p>
          <p className="text-[10px] mt-0.5" style={{ color: sub }}>de Estudos</p>
        </div>

        {/* Level chip */}
        <div className="mx-3 mb-4 rounded-xl p-2.5" style={{ background: darkMode ? '#1e1a16' : '#fff', border: cardBorder }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span style={{ fontSize: 16 }}>{curLevel.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>Nível {curLevel.level}</p>
              <p className="text-[9px] truncate" style={{ color: sub }}>{curLevel.name}</p>
            </div>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: darkMode ? '#2e2820' : '#f0e6d3' }}>
            <div className="h-full rounded-full" style={{ width: `${xpPct}%`, background: accent }} />
          </div>
          <p className="text-[9px] mt-0.5 text-right" style={{ color: sub }}>{profile.xp.toLocaleString()} XP</p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-0.5 px-2">
          {NAV.map(({ key, icon, label }) => {
            const active = activeScreen === key || (key === 'subjects' && activeScreen === 'subject-detail')
            return (
              <button key={key}
                onClick={() => { if (key === 'subjects') setSelectedSubjectId(null); setScreen(key as Screen) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all text-xs font-semibold"
                style={{
                  background: active ? (darkMode ? 'rgba(224,123,57,0.15)' : 'rgba(224,123,57,0.1)') : 'transparent',
                  color: active ? accent : (darkMode ? 'rgba(240,230,211,0.6)' : '#7a5c3c'),
                  fontFamily: 'Outfit, sans-serif',
                  borderLeft: active ? `3px solid ${accent}` : '3px solid transparent',
                }}>
                <span style={{ fontSize: 15 }}>{icon}</span>
                {label}
              </button>
            )
          })}
        </nav>

        {/* Streak badge */}
        <div className="mx-3 mt-3 px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: darkMode ? '#1e1a16' : '#fff', border: cardBorder }}>
          <span style={{ fontSize: 16 }}>🔥</span>
          <div>
            <p className="text-xs font-bold" style={{ color: text }}>{profile.streak} dias</p>
            <p className="text-[9px]" style={{ color: sub }}>Sequência atual</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeScreen === 'overview' && renderOverview()}
        {activeScreen === 'subjects' && renderSubjects()}
        {activeScreen === 'subject-detail' && renderSubjectDetail()}
        {activeScreen === 'pomodoro' && renderPomodoro()}
        {activeScreen === 'history' && renderHistory()}
        {activeScreen === 'goals' && renderGoals()}
        {activeScreen === 'challenges' && renderChallenges()}
        {activeScreen === 'progress' && renderProgress()}
        {activeScreen === 'achievements' && renderAchievements()}
      </div>
    </div>
  )
}
