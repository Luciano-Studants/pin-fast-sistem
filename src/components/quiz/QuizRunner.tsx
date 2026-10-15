import { useState, useEffect, useMemo, useRef } from 'react'
import type { Quiz, QuizQuestion, QuizAttempt, QuizAttemptAnswer } from '../../types'
import { newId } from '../../lib/id'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface ShuffledQuestion {
  question: QuizQuestion
  shuffledChoices: { id: string; text: string; correct: boolean }[]
}

interface Props {
  quiz: Quiz
  darkMode: boolean
  onFinish: (attempt: QuizAttempt) => void
  onCancel: () => void
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function QuizRunner({ quiz, darkMode, onFinish, onCancel }: Props) {
  const dm = darkMode
  const bg = dm ? '#161210' : '#f5ede0'
  const card = dm ? '#1e1a16' : '#fff'
  const border = dm ? '#2e2820' : '#e8d5b7'
  const text = dm ? '#f0e6d3' : '#2d1a0a'
  const sub = dm ? '#8a7a6a' : '#9a7a5a'
  const accent = '#e07b39'

  // Shuffle questions + choices once on mount
  const shuffled = useMemo<ShuffledQuestion[]>(() => {
    return shuffle(quiz.questions).map((q) => ({
      question: q,
      shuffledChoices: q.type === 'subjective' ? [] : shuffle(q.choices),
    }))
  }, [quiz.id])

  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, QuizAttemptAnswer>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(
    quiz.timeLimitMinutes ? quiz.timeLimitMinutes * 60 : null
  )
  const startedAt = useRef(new Date().toISOString())
  const answersRef = useRef(answers)
  useEffect(() => { answersRef.current = answers }, [answers])

  // Timer — use ref to avoid stale closure on submit
  const submitRef = useRef<() => void>(() => {})
  useEffect(() => {
    submitRef.current = () => {
      const allAnswers: QuizAttemptAnswer[] = shuffled.map(({ question }) => ({
        ...(answersRef.current[question.id] ?? {}),
        questionId: question.id,
      }))
      let score = 0; let total = 0
      for (const { question } of shuffled) {
        if (question.type === 'subjective') continue
        total++
        const a = answersRef.current[question.id]
        const correctIds = new Set(question.choices.filter((c) => c.correct).map((c) => c.id))
        const selectedIds = new Set(a?.selectedChoiceIds ?? [])
        const isCorrect = correctIds.size === selectedIds.size && [...correctIds].every((id) => selectedIds.has(id))
        if (isCorrect) score++
      }
      onFinish({ id: newId(), quizId: quiz.id, answers: allAnswers, startedAt: startedAt.current, finishedAt: new Date().toISOString(), score, total })
    }
  })

  useEffect(() => {
    if (timeLeft === null) return
    if (timeLeft <= 0) { submitRef.current(); return }
    const t = setInterval(() => setTimeLeft((s) => (s !== null ? s - 1 : null)), 1000)
    return () => clearInterval(t)
  }, [timeLeft])

  const q = shuffled[current]
  const totalQ = shuffled.length
  const ans = answers[q.question.id]

  const setAnswer = (patch: Partial<QuizAttemptAnswer>) =>
    setAnswers((a) => ({
      ...a,
      [q.question.id]: { ...a[q.question.id], ...patch, questionId: q.question.id },
    }))

  const toggleChoice = (choiceId: string) => {
    const existing = ans?.selectedChoiceIds ?? []
    if (q.question.type === 'single') {
      setAnswer({ selectedChoiceIds: [choiceId] })
    } else {
      setAnswer({
        selectedChoiceIds: existing.includes(choiceId)
          ? existing.filter((id) => id !== choiceId)
          : [...existing, choiceId],
      })
    }
  }

  const submit = () => submitRef.current()

  const answered = (qId: string) => {
    const a = answers[qId]
    if (!a) return false
    const sq = shuffled.find((s) => s.question.id === qId)
    if (!sq) return false
    if (sq.question.type === 'subjective') return !!(a.textAnswer?.trim())
    return !!(a.selectedChoiceIds?.length)
  }

  const timerDanger = timeLeft !== null && timeLeft <= 60

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: bg }}>
      {/* Header */}
      <div className="px-3 sm:px-6 py-3 shrink-0 flex items-center justify-between gap-2" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-black/8 transition-colors" style={{ color: sub }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h2 className="text-sm font-black leading-tight" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>{quiz.title}</h2>
            <p className="text-[10px]" style={{ color: sub }}>Questão {current + 1} de {totalQ}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {timeLeft !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold tabular-nums text-sm"
              style={{
                background: timerDanger ? 'rgba(239,68,68,0.12)' : dm ? '#2e2820' : '#f0e6d3',
                color: timerDanger ? '#ef4444' : sub,
                fontFamily: 'Outfit, sans-serif',
                border: timerDanger ? '1px solid rgba(239,68,68,0.3)' : `1px solid ${border}`,
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {formatTime(timeLeft)}
            </div>
          )}
          <button onClick={submit}
            className="hidden sm:block px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
            style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
            Finalizar
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: dm ? '#2e2820' : '#e8d5b7' }}>
        <div style={{ height: '100%', width: `${((current + 1) / totalQ) * 100}%`, background: accent, transition: 'width 0.3s ease' }} />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Question area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-6">
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Type badge + prompt */}
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 inline-block"
                style={{ background: dm ? '#2e2820' : '#f0e6d3', color: sub, fontFamily: 'Outfit, sans-serif' }}>
                {q.question.type === 'multiple' ? 'Múltipla escolha' : q.question.type === 'single' ? 'Alternativa única' : 'Dissertativa'}
              </span>
              <p className="text-base font-semibold leading-relaxed" style={{ color: text, fontFamily: 'Outfit, sans-serif' }}>
                {q.question.prompt}
              </p>
            </div>

            {/* Choices */}
            {(q.question.type === 'multiple' || q.question.type === 'single') && (
              <div className="space-y-2">
                {q.shuffledChoices.map((c, i) => {
                  const selected = ans?.selectedChoiceIds?.includes(c.id) ?? false
                  return (
                    <button key={c.id} onClick={() => toggleChoice(c.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:scale-[1.01]"
                      style={{
                        background: selected ? (dm ? 'rgba(224,123,57,0.15)' : 'rgba(224,123,57,0.08)') : (dm ? '#252018' : '#fef9f3'),
                        border: `1.5px solid ${selected ? accent : border}`,
                      }}>
                      <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          background: selected ? accent : dm ? '#2e2820' : '#f0e6d3',
                          color: selected ? '#fff' : sub,
                          fontFamily: 'Nunito, sans-serif',
                        }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm font-medium" style={{ color: text, fontFamily: 'Outfit, sans-serif' }}>
                        {c.text}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Subjective */}
            {q.question.type === 'subjective' && (
              <textarea
                value={ans?.textAnswer ?? ''}
                onChange={(e) => setAnswer({ textAnswer: e.target.value })}
                rows={5}
                className="w-full text-sm px-4 py-3 rounded-xl resize-none"
                style={{
                  background: dm ? '#252018' : '#fff',
                  color: text,
                  border: `1.5px solid ${border}`,
                  fontFamily: 'Outfit, sans-serif',
                  outline: 'none',
                }}
                placeholder="Escreva sua resposta aqui…"
              />
            )}
          </div>
        </div>

        {/* Side nav */}
        <div className="hidden md:block w-48 shrink-0 overflow-y-auto py-4 px-3" style={{ borderLeft: `1px solid ${border}` }}>
          <p className="text-[10px] font-bold mb-2 px-1" style={{ color: sub, fontFamily: 'Nunito, sans-serif' }}>NAVEGAR</p>
          <div className="grid grid-cols-4 gap-1">
            {shuffled.map(({ question }, i) => {
              const isCurrent = i === current
              const isDone = answered(question.id)
              return (
                <button key={question.id} onClick={() => setCurrent(i)}
                  className="w-full aspect-square flex items-center justify-center text-xs font-bold rounded-lg transition-all"
                  style={{
                    background: isCurrent ? accent : isDone ? (dm ? '#253020' : '#e8f5e9') : (dm ? '#252018' : '#f5ede0'),
                    color: isCurrent ? '#fff' : isDone ? '#22c55e' : sub,
                    border: isCurrent ? 'none' : `1px solid ${border}`,
                    fontFamily: 'Outfit, sans-serif',
                  }}>
                  {i + 1}
                </button>
              )
            })}
          </div>
          <div className="mt-4 space-y-1 px-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: accent }} />
              <span className="text-[10px]" style={{ color: sub }}>Atual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: dm ? '#253020' : '#e8f5e9', border: '1px solid #22c55e' }} />
              <span className="text-[10px]" style={{ color: sub }}>Respondida</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="px-3 sm:px-8 py-3 sm:py-4 shrink-0 flex items-center justify-between gap-2" style={{ borderTop: `1px solid ${border}` }}>
        <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-30 hover:opacity-80 transition-opacity"
          style={{ color: sub, background: dm ? '#2e2820' : '#f0e6d3', fontFamily: 'Nunito, sans-serif' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <span className="hidden sm:inline text-xs font-semibold tabular-nums" style={{ color: sub }}>
          {Object.keys(answers).filter((id) => answered(id)).length}/{totalQ} respondidas
        </span>
        {current < totalQ - 1 ? (
          <button onClick={() => setCurrent((c) => Math.min(totalQ - 1, c + 1))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
            <span className="hidden sm:inline">Próxima</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ) : (
          <button onClick={submit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity active:scale-95"
            style={{ background: '#22c55e', color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
            Entregar
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        )}
      </div>
    </div>
  )
}
