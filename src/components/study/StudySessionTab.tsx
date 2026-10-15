import { useEffect, useMemo, useRef, useState } from 'react'
import * as store from '../../lib/store/store'

type PresetKey = 'classic' | 'focus' | 'deep' | 'custom'
type TimerPhase = 'config' | 'running' | 'paused' | 'break' | 'done'

interface TimerConfig {
  study: number
  shortBreak: number
  longBreak: number
  sessions: number
}

interface Preset extends TimerConfig {
  key: PresetKey
  label: string
  description: string
}

const PRESETS: Preset[] = [
  { key: 'classic', label: 'Clássico', description: 'Ritmo equilibrado', study: 25, shortBreak: 5, longBreak: 15, sessions: 4 },
  { key: 'focus', label: 'Foco', description: 'Blocos mais longos', study: 50, shortBreak: 10, longBreak: 30, sessions: 3 },
  { key: 'deep', label: 'Profundo', description: 'Imersão prolongada', study: 90, shortBreak: 20, longBreak: 30, sessions: 2 },
  { key: 'custom', label: 'Personalizado', description: 'Defina seu ritmo', study: 25, shortBreak: 5, longBreak: 15, sessions: 4 },
]

const DEFAULT_CUSTOM: TimerConfig = { study: 25, shortBreak: 5, longBreak: 15, sessions: 4 }

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainingSeconds}`
}

function loadSettings(): { preset: PresetKey; custom: TimerConfig } {
  try {
    const saved = store.get<{ preset?: string; custom?: Partial<TimerConfig> }>('study-session-settings-v1', {})
    const preset: PresetKey = PRESETS.find((item) => item.key === saved.preset)?.key ?? 'classic'
    return { preset, custom: { ...DEFAULT_CUSTOM, ...saved.custom } }
  } catch {
    return { preset: 'classic', custom: DEFAULT_CUSTOM }
  }
}

interface Props {
  darkMode: boolean
}

export default function StudySessionTab({ darkMode }: Props) {
  const initialSettings = useMemo(loadSettings, [])
  const [presetKey, setPresetKey] = useState<PresetKey>(initialSettings.preset)
  const [customConfig, setCustomConfig] = useState<TimerConfig>(initialSettings.custom)
  const [phase, setPhase] = useState<TimerPhase>('config')
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  const [completedFocusSessions, setCompletedFocusSessions] = useState(0)
  const endAtRef = useRef(0)
  const pausedPhaseRef = useRef<'running' | 'break'>('running')

  const preset = PRESETS.find((item) => item.key === presetKey) ?? PRESETS[0]
  const config = presetKey === 'custom' ? customConfig : preset

  const colors = {
    background: darkMode ? '#161210' : '#f5ede0',
    surface: darkMode ? '#1e1a16' : '#fffdf9',
    surfaceMuted: darkMode ? '#252018' : '#f0e6d3',
    border: darkMode ? '#3a3028' : '#e8d5b7',
    text: darkMode ? '#f0e6d3' : '#2d1a0a',
    muted: darkMode ? '#9a8878' : '#8b6d50',
    accent: '#e07b39',
    success: '#3f8f62',
    danger: '#d95c4f',
  }

  useEffect(() => {
    store.set('study-session-settings-v1', { preset: presetKey, custom: customConfig })
  }, [presetKey, customConfig])

  useEffect(() => {
    if (phase !== 'running' && phase !== 'break') return

    const timerPhase = phase
    const tick = () => {
      const next = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
      setTimeLeft(next)
      if (next > 0) return

      if (timerPhase === 'running') {
        setCompletedFocusSessions((current) => current + 1)
        setPhase('done')
      } else {
        setPhase('config')
      }
    }

    tick()
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [phase])

  const startTimer = (minutes: number, nextPhase: 'running' | 'break') => {
    const seconds = minutes * 60
    setTotalTime(seconds)
    setTimeLeft(seconds)
    endAtRef.current = Date.now() + seconds * 1000
    setPhase(nextPhase)
  }

  const startFocus = () => startTimer(config.study, 'running')

  const startBreak = () => {
    const useLongBreak = completedFocusSessions > 0 && completedFocusSessions % config.sessions === 0
    startTimer(useLongBreak ? config.longBreak : config.shortBreak, 'break')
  }

  const pauseTimer = () => {
    pausedPhaseRef.current = phase === 'break' ? 'break' : 'running'
    setTimeLeft(Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)))
    setPhase('paused')
  }

  const resumeTimer = () => {
    endAtRef.current = Date.now() + timeLeft * 1000
    setPhase(pausedPhaseRef.current)
  }

  const resetCycle = () => {
    setPhase('config')
    setTimeLeft(0)
    setTotalTime(0)
    setCompletedFocusSessions(0)
  }

  const selectPreset = (key: PresetKey) => {
    setPresetKey(key)
    setCompletedFocusSessions(0)
  }

  const updateCustom = (field: keyof TimerConfig, value: string) => {
    const limits: Record<keyof TimerConfig, [number, number]> = {
      study: [5, 180],
      shortBreak: [1, 30],
      longBreak: [5, 60],
      sessions: [1, 10],
    }
    const parsed = Number.parseInt(value, 10)
    const [minimum, maximum] = limits[field]
    const nextValue = Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : minimum
    setPresetKey('custom')
    setCustomConfig((current) => ({ ...current, [field]: nextValue }))
  }

  const progress = totalTime > 0 ? timeLeft / totalTime : 1
  const radius = 76
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)
  const isBreak = phase === 'break' || (phase === 'paused' && pausedPhaseRef.current === 'break')
  const timerColor = isBreak ? colors.success : timeLeft <= 60 && phase === 'running' ? colors.danger : colors.accent
  const completedInCycle = completedFocusSessions % config.sessions

  const inputStyle = {
    width: '100%',
    background: darkMode ? '#161210' : '#fffaf4',
    border: `1.5px solid ${colors.border}`,
    borderRadius: 12,
    padding: '10px 12px',
    color: colors.text,
    fontFamily: 'Outfit, sans-serif',
    fontSize: 14,
    outline: 'none',
  }

  if (phase === 'running' || phase === 'paused' || phase === 'break') {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: colors.background, fontFamily: 'Outfit, sans-serif' }}>
        <div className="min-h-full flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center gap-2 mb-8">
            <span className="w-2 h-2 rounded-full" style={{ background: timerColor }} />
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: colors.muted }}>
              {isBreak ? 'Pausa' : 'Tempo de foco'}
            </p>
          </div>

          <div className="relative mb-7">
            <svg width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">
              <circle cx="110" cy="110" r={radius} fill="none" stroke={colors.surfaceMuted} strokeWidth="10" />
              <circle
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke={timerColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 110 110)"
                style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.2s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-black tabular-nums tracking-tight" style={{ color: timerColor, fontFamily: 'Nunito, sans-serif' }}>
                {formatTime(timeLeft)}
              </span>
              <span className="text-xs font-semibold mt-2" style={{ color: colors.muted }}>
                {phase === 'paused' ? 'Pausado' : isBreak ? 'Respire e descanse' : preset.label}
              </span>
            </div>
          </div>

          {!isBreak && (
            <div className="flex items-center gap-2 mb-8" aria-label={`${completedInCycle} de ${config.sessions} sessões concluídas no ciclo`}>
              {Array.from({ length: config.sessions }, (_, index) => (
                <span
                  key={index}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: index === completedInCycle ? 28 : 12,
                    background: index < completedInCycle ? colors.accent : colors.border,
                  }}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {phase === 'paused' ? (
              <button
                onClick={resumeTimer}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                style={{ background: colors.accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                Continuar
              </button>
            ) : (
              <button
                onClick={pauseTimer}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                style={{ background: colors.surface, color: colors.text, border: `1.5px solid ${colors.border}`, fontFamily: 'Nunito, sans-serif' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z" /></svg>
                Pausar
              </button>
            )}
            <button
              onClick={resetCycle}
              className="px-6 py-3 rounded-2xl text-sm font-semibold transition-all hover:opacity-80"
              style={{ background: colors.surfaceMuted, color: colors.danger, fontFamily: 'Nunito, sans-serif' }}
            >
              Encerrar
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: colors.background, fontFamily: 'Outfit, sans-serif' }}>
        <div className="min-h-full flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-10">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: darkMode ? 'rgba(63,143,98,0.16)' : '#e5f2e9', color: colors.success }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: colors.success }}>Sessão concluída</p>
          <h2 className="text-3xl font-black text-center" style={{ color: colors.text, fontFamily: 'Nunito, sans-serif' }}>
            {config.study} minutos de foco
          </h2>
          <p className="text-sm mt-2 mb-7 text-center" style={{ color: colors.muted }}>
            Faça uma pausa antes de iniciar o próximo bloco.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={startBreak}
              className="px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
              style={{ background: colors.success, color: '#fff', fontFamily: 'Nunito, sans-serif' }}
            >
              Iniciar pausa
            </button>
            <button
              onClick={startFocus}
              className="px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
              style={{ background: colors.accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}
            >
              Próxima sessão
            </button>
            <button
              onClick={resetCycle}
              className="px-5 py-3 rounded-2xl text-sm font-semibold transition-all hover:opacity-80"
              style={{ background: colors.surfaceMuted, color: colors.muted, fontFamily: 'Nunito, sans-serif' }}
            >
              Finalizar ciclo
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: colors.background, fontFamily: 'Outfit, sans-serif' }}>
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="mb-7">
          <div className="flex items-center gap-2 mb-2" style={{ color: colors.accent }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 1.5M9 2h6M12 2v3" />
            </svg>
            <span className="text-xs font-black uppercase tracking-[0.18em]">Foco</span>
          </div>
          <h2 className="text-2xl font-black" style={{ color: colors.text, fontFamily: 'Nunito, sans-serif' }}>Sessão de Estudos</h2>
          <p className="text-sm mt-1 max-w-xl" style={{ color: colors.muted }}>
            Escolha a intensidade, ajuste os intervalos e concentre-se em uma tarefa por vez.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {PRESETS.map((item) => {
            const active = presetKey === item.key
            return (
              <button
                key={item.key}
                onClick={() => selectPreset(item.key)}
                className="p-4 rounded-2xl text-left transition-all hover:-translate-y-0.5"
                style={{
                  background: active ? (darkMode ? 'rgba(224,123,57,0.14)' : '#fff7ef') : colors.surface,
                  border: `1.5px solid ${active ? colors.accent : colors.border}`,
                  boxShadow: active ? '0 8px 24px rgba(224,123,57,0.12)' : 'none',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black" style={{ background: active ? colors.accent : colors.surfaceMuted, color: active ? '#fff' : colors.muted }}>
                    {item.key === 'classic' ? '25' : item.key === 'focus' ? '50' : item.key === 'deep' ? '90' : '—'}
                  </span>
                  {active && <span className="w-2 h-2 rounded-full" style={{ background: colors.accent }} />}
                </div>
                <p className="text-sm font-black" style={{ color: active ? colors.accent : colors.text, fontFamily: 'Nunito, sans-serif' }}>{item.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: colors.muted }}>{item.description}</p>
              </button>
            )
          })}
        </div>

        <div className="rounded-3xl p-5 sm:p-6" style={{ background: colors.surface, border: `1.5px solid ${colors.border}` }}>
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <p className="text-sm font-black" style={{ color: colors.text, fontFamily: 'Nunito, sans-serif' }}>Configuração do ciclo</p>
              <p className="text-xs mt-0.5" style={{ color: colors.muted }}>Alterar um valor ativa o modo personalizado.</p>
            </div>
            <div className="px-3 py-1.5 rounded-xl text-xs font-bold shrink-0" style={{ background: colors.surfaceMuted, color: colors.accent }}>
              {config.study} min de foco
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ['study', 'Tempo de estudo', '5–180 min'],
              ['shortBreak', 'Pausa curta', '1–30 min'],
              ['longBreak', 'Pausa longa', '5–60 min'],
              ['sessions', 'Sessões por ciclo', '1–10 sessões'],
            ] as const).map(([field, label, hint]) => (
              <label key={field}>
                <span className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold" style={{ color: colors.text }}>{label}</span>
                  <span className="text-[10px]" style={{ color: colors.muted }}>{hint}</span>
                </span>
                <input
                  type="number"
                  value={config[field]}
                  onChange={(event) => updateCustom(field, event.target.value)}
                  style={inputStyle}
                />
              </label>
            ))}
          </div>

          <div className="mt-6 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderTop: `1px solid ${colors.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: colors.surfaceMuted, color: colors.accent }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 6v6l4 2" /><circle cx="12" cy="12" r="9" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: colors.text }}>{preset.label}</p>
                <p className="text-[11px]" style={{ color: colors.muted }}>
                  {config.sessions} blocos · pausa de {config.shortBreak} min
                </p>
              </div>
            </div>
            <button
              onClick={startFocus}
              className="flex items-center justify-center gap-2 px-7 py-3 rounded-2xl text-sm font-black transition-all hover:opacity-90 active:scale-95"
              style={{ background: colors.accent, color: '#fff', fontFamily: 'Nunito, sans-serif', boxShadow: '0 8px 24px rgba(224,123,57,0.22)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              Iniciar sessão
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
