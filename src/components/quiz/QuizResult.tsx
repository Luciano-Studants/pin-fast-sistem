import { useState } from 'react'
import type { Quiz, QuizAttempt } from '../../types'

interface Props {
  quiz: Quiz
  attempt: QuizAttempt
  darkMode: boolean
  onRetry: () => void
  onBack: () => void
}

function elapsed(start: string, end?: string) {
  if (!end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}min ${s}s` : `${s}s`
}

export default function QuizResult({ quiz, attempt, darkMode, onRetry, onBack }: Props) {
  const [selfScores, setSelfScores] = useState<Record<string, boolean>>({})
  const toggleSelf = (qId: string, val: boolean) =>
    setSelfScores((s) => ({ ...s, [qId]: val }))
  const dm = darkMode
  const bg = dm ? '#161210' : '#f5ede0'
  const card = dm ? '#1e1a16' : '#fff'
  const border = dm ? '#2e2820' : '#e8d5b7'
  const text = dm ? '#f0e6d3' : '#2d1a0a'
  const sub = dm ? '#8a7a6a' : '#9a7a5a'
  const accent = '#e07b39'

  const { score = 0, total = 0 } = attempt
  const selfSubjScore = Object.values(selfScores).filter(Boolean).length
  const selfSubjTotal = Object.keys(selfScores).length
  const totalAll = total + selfSubjTotal
  const scoreAll = score + selfSubjScore
  const pct = totalAll > 0 ? Math.round((scoreAll / totalAll) * 100) : 0
  const subjectiveCount = quiz.questions.filter((q) => q.type === 'subjective').length

  const grade =
    pct >= 90 ? { label: 'Excelente!', color: '#22c55e' } :
    pct >= 70 ? { label: 'Bom!', color: '#3b82f6' } :
    pct >= 50 ? { label: 'Regular', color: '#f59e0b' } :
    { label: 'Precisa melhorar', color: '#ef4444' }

  // Build review per question preserving quiz order
  const reviewItems = quiz.questions.map((q) => {
    const a = attempt.answers.find((x) => x.questionId === q.id)
    if (q.type === 'subjective') {
      return { q, a, correct: null, isSubjective: true }
    }
    const correctIds = new Set(q.choices.filter((c) => c.correct).map((c) => c.id))
    const selectedIds = new Set(a?.selectedChoiceIds ?? [])
    const correct =
      correctIds.size === selectedIds.size &&
      [...correctIds].every((id) => selectedIds.has(id))
    return { q, a, correct, isSubjective: false }
  })

  const time = elapsed(attempt.startedAt, attempt.finishedAt)

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: bg }}>
      {/* Header */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 shrink-0 flex items-center justify-between gap-2" style={{ borderBottom: `1px solid ${border}` }}>
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity"
          style={{ color: sub, fontFamily: 'Nunito, sans-serif' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <button onClick={onRetry}
          className="px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity active:scale-95"
          style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
          Tentar novamente
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* Score card */}
        <div className="max-w-2xl mx-auto rounded-2xl overflow-hidden" style={{ background: card, border: `1.5px solid ${border}` }}>
          <div className="px-6 py-6 text-center">
            <h2 className="text-lg font-black mb-1" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>{quiz.title}</h2>
            {time && <p className="text-xs mb-5" style={{ color: sub }}>Tempo: {time}</p>}

            {/* Circle score */}
            <div className="flex justify-center mb-4">
              <div className="relative w-28 h-28">
                <svg width="112" height="112" viewBox="0 0 112 112">
                  <circle cx="56" cy="56" r="48" fill="none" stroke={dm ? '#2e2820' : '#f0e6d3'} strokeWidth="8"/>
                  <circle cx="56" cy="56" r="48" fill="none"
                    stroke={grade.color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 48}`}
                    strokeDashoffset={`${2 * Math.PI * 48 * (1 - pct / 100)}`}
                    transform="rotate(-90 56 56)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black" style={{ color: grade.color, fontFamily: 'Nunito, sans-serif' }}>{pct}%</span>
                  <span className="text-[10px] font-semibold" style={{ color: sub }}>{score}/{total}</span>
                </div>
              </div>
            </div>

            <p className="text-base font-black mb-1" style={{ color: grade.color, fontFamily: 'Nunito, sans-serif' }}>{grade.label}</p>
            <p className="text-xs" style={{ color: sub }}>
              {score} acerto{score !== 1 ? 's' : ''} de {total} questão{total !== 1 ? 'ões' : ''} objetiva{total !== 1 ? 's' : ''}
              {subjectiveCount > 0 && ` · ${subjectiveCount} dissertativa${subjectiveCount !== 1 ? 's' : ''} (auto-avaliação)`}
            </p>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 divide-x" style={{ borderTop: `1px solid ${border}` }}>
            {[
              { label: 'Acertos', value: score, color: '#22c55e' },
              { label: 'Erros', value: total - score, color: '#ef4444' },
              { label: 'Nota', value: `${pct}%`, color: grade.color },
            ].map(({ label, value, color }) => (
              <div key={label} className="py-3 text-center" style={{ borderRight: `1px solid ${border}` }}>
                <p className="text-lg font-black" style={{ color, fontFamily: 'Nunito, sans-serif' }}>{value}</p>
                <p className="text-[10px] font-semibold" style={{ color: sub }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Question review */}
        <div className="max-w-2xl mx-auto space-y-3">
          <h3 className="text-sm font-black" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>Revisão das questões</h3>
          {reviewItems.map(({ q, a, correct, isSubjective }, i) => (
            <div key={q.id} className="rounded-2xl overflow-hidden" style={{ background: card, border: `1.5px solid ${border}` }}>
              {/* Question header */}
              <div className="flex items-center gap-3 px-4 py-3" style={{
                borderBottom: `1px solid ${border}`,
                background: isSubjective
                  ? dm ? '#252020' : '#fffbf5'
                  : correct
                    ? dm ? '#1a2e1a' : '#f0fdf4'
                    : dm ? '#2e1a1a' : '#fef2f2',
              }}>
                <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black"
                  style={{
                    background: isSubjective ? sub : correct ? '#22c55e' : '#ef4444',
                    color: '#fff',
                    fontFamily: 'Nunito, sans-serif',
                  }}>
                  {isSubjective ? '?' : correct ? '✓' : '✗'}
                </span>
                <span className="text-xs font-bold" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>
                  Questão {i + 1}
                  {isSubjective && <span className="ml-1 font-normal" style={{ color: sub }}>(dissertativa)</span>}
                </span>
                {!isSubjective && (
                  <span className="ml-auto text-xs font-bold" style={{ color: correct ? '#22c55e' : '#ef4444' }}>
                    {correct ? 'Correto' : 'Incorreto'}
                  </span>
                )}
              </div>

              <div className="p-4 space-y-3">
                <p className="text-sm font-medium" style={{ color: text, fontFamily: 'Outfit, sans-serif' }}>{q.prompt}</p>

                {/* Objective review */}
                {!isSubjective && (
                  <div className="space-y-1.5">
                    {q.choices.map((c) => {
                      const wasSelected = a?.selectedChoiceIds?.includes(c.id)
                      const isCorrect = c.correct
                      let bg2 = 'transparent'
                      let borderColor = border
                      let color2 = sub
                      if (isCorrect && wasSelected) { bg2 = dm ? '#1a2e1a' : '#f0fdf4'; borderColor = '#22c55e'; color2 = '#22c55e' }
                      else if (isCorrect) { bg2 = dm ? '#1a2e1a' : '#f0fdf4'; borderColor = '#22c55e'; color2 = '#22c55e' }
                      else if (wasSelected) { bg2 = dm ? '#2e1a1a' : '#fef2f2'; borderColor = '#ef4444'; color2 = '#ef4444' }
                      return (
                        <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ background: bg2, border: `1.5px solid ${borderColor}` }}>
                          <span className="text-[10px] font-bold" style={{ color: color2 }}>
                            {isCorrect ? '✓' : wasSelected ? '✗' : '○'}
                          </span>
                          <span className="text-xs" style={{ color: isCorrect || wasSelected ? color2 : sub, fontFamily: 'Outfit, sans-serif' }}>
                            {c.text}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Subjective review */}
                {isSubjective && (
                  <div className="space-y-2">
                    {a?.textAnswer && (
                      <div className="rounded-xl px-3 py-2" style={{ background: dm ? '#252018' : '#fef9f3', border: `1px solid ${border}` }}>
                        <p className="text-[10px] font-bold mb-1" style={{ color: sub }}>Sua resposta</p>
                        <p className="text-xs leading-relaxed" style={{ color: text, fontFamily: 'Outfit, sans-serif' }}>{a.textAnswer}</p>
                      </div>
                    )}
                    {q.subjectiveAnswer && (
                      <div className="rounded-xl px-3 py-2" style={{ background: dm ? '#1a2e1a' : '#f0fdf4', border: `1px solid #22c55e` }}>
                        <p className="text-[10px] font-bold mb-1" style={{ color: '#22c55e' }}>Resposta modelo</p>
                        <p className="text-xs leading-relaxed" style={{ color: text, fontFamily: 'Outfit, sans-serif' }}>{q.subjectiveAnswer}</p>
                      </div>
                    )}
                    {!a?.textAnswer && <p className="text-xs" style={{ color: sub }}>Não respondida</p>}
                    {/* Self-score */}
                    <div>
                      <p className="text-[10px] font-bold mb-1.5" style={{ color: sub }}>Você acertou?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleSelf(q.id, true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                          style={{
                            background: selfScores[q.id] === true ? '#22c55e' : dm ? '#252018' : '#f0fdf4',
                            color: selfScores[q.id] === true ? '#fff' : '#22c55e',
                            border: `1.5px solid ${selfScores[q.id] === true ? '#22c55e' : 'rgba(34,197,94,0.3)'}`,
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          Acertei
                        </button>
                        <button
                          onClick={() => toggleSelf(q.id, false)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                          style={{
                            background: selfScores[q.id] === false ? '#ef4444' : dm ? '#252018' : '#fef2f2',
                            color: selfScores[q.id] === false ? '#fff' : '#ef4444',
                            border: `1.5px solid ${selfScores[q.id] === false ? '#ef4444' : 'rgba(239,68,68,0.3)'}`,
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Errei
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
