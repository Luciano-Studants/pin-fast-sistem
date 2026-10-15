import { useState, useEffect } from 'react'
import type { Quiz, QuizAttempt } from '../../types'
import QuizEditor from './QuizEditor'
import QuizRunner from './QuizRunner'
import QuizResult from './QuizResult'
import * as store from '../../lib/store/store'

type Screen =
  | { view: 'list' }
  | { view: 'editor'; quiz?: Quiz }
  | { view: 'runner'; quiz: Quiz }
  | { view: 'result'; quiz: Quiz; attempt: QuizAttempt }

function loadQuizzes(): Quiz[] {
  const parsed = store.get<unknown>('quizzes-v1', [])
  return Array.isArray(parsed) ? parsed as Quiz[] : []
}

function saveQuizzes(qs: Quiz[]) {
  store.set('quizzes-v1', qs)
}

function loadAttempts(): QuizAttempt[] {
  const parsed = store.get<unknown>('quiz-attempts-v1', [])
  return Array.isArray(parsed) ? parsed as QuizAttempt[] : []
}

function saveAttempts(as: QuizAttempt[]) {
  store.set('quiz-attempts-v1', as)
}

interface Props {
  darkMode: boolean
}

export default function QuizTab({ darkMode }: Props) {
  const [quizzes, setQuizzes] = useState<Quiz[]>(loadQuizzes)
  const [attempts, setAttempts] = useState<QuizAttempt[]>(loadAttempts)
  const [screen, setScreen] = useState<Screen>({ view: 'list' })

  const dm = darkMode
  const bg = dm ? '#161210' : '#f5ede0'
  const card = dm ? '#1e1a16' : '#fff'
  const border = dm ? '#2e2820' : '#e8d5b7'
  const text = dm ? '#f0e6d3' : '#2d1a0a'
  const sub = dm ? '#8a7a6a' : '#9a7a5a'
  const accent = '#e07b39'

  useEffect(() => { saveQuizzes(quizzes) }, [quizzes])
  useEffect(() => { saveAttempts(attempts) }, [attempts])

  const handleSave = (quiz: Quiz) => {
    setQuizzes((qs) => {
      const idx = qs.findIndex((q) => q.id === quiz.id)
      return idx >= 0 ? qs.map((q, i) => i === idx ? quiz : q) : [...qs, quiz]
    })
    setScreen({ view: 'list' })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este questionário?')) return
    setQuizzes((qs) => qs.filter((q) => q.id !== id))
    setAttempts((as) => as.filter((a) => a.quizId !== id))
  }

  const handleFinish = (quiz: Quiz, attempt: QuizAttempt) => {
    setAttempts((as) => [...as, attempt])
    setScreen({ view: 'result', quiz, attempt })
  }

  // --- screens ---
  if (screen.view === 'editor') {
    return (
      <QuizEditor
        quiz={screen.quiz}
        darkMode={darkMode}
        onSave={handleSave}
        onCancel={() => setScreen({ view: 'list' })}
      />
    )
  }

  if (screen.view === 'runner') {
    return (
      <QuizRunner
        quiz={screen.quiz}
        darkMode={darkMode}
        onFinish={(attempt) => handleFinish(screen.quiz, attempt)}
        onCancel={() => setScreen({ view: 'list' })}
      />
    )
  }

  if (screen.view === 'result') {
    return (
      <QuizResult
        quiz={screen.quiz}
        attempt={screen.attempt}
        darkMode={darkMode}
        onRetry={() => setScreen({ view: 'runner', quiz: screen.quiz })}
        onBack={() => setScreen({ view: 'list' })}
      />
    )
  }

  // List view
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: bg }}>
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 20 }}>📝</span>
          <div>
            <h2 className="text-base font-black leading-tight" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>
              Questionários
            </h2>
            <p className="text-xs" style={{ color: sub, fontFamily: 'Outfit, sans-serif' }}>
              Crie e realize questionários para estudo e revisão
            </p>
          </div>
        </div>
        <button
          onClick={() => setScreen({ view: 'editor' })}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
          style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo questionário
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5">
        {quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 pb-12">
            <div className="w-20 h-20 flex items-center justify-center rounded-full" style={{ background: dm ? '#2e2820' : '#f0e6d3' }}>
              <span style={{ fontSize: 36 }}>📝</span>
            </div>
            <div className="text-center">
              <p className="text-base font-black mb-1" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>Nenhum questionário ainda</p>
              <p className="text-sm" style={{ color: sub }}>Crie seu primeiro para começar a estudar</p>
            </div>
            <button
              onClick={() => setScreen({ view: 'editor' })}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
              style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Criar questionário
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-w-4xl">
            {quizzes.map((quiz) => {
              const quizAttempts = attempts.filter((a) => a.quizId === quiz.id)
              const lastAttempt = quizAttempts.at(-1)
              const bestScore = quizAttempts.length > 0
                ? Math.max(...quizAttempts.map((a) => a.total ? Math.round((a.score ?? 0) / a.total * 100) : 0))
                : null

              return (
                <div key={quiz.id} className="rounded-2xl overflow-hidden transition-all hover:shadow-md"
                  style={{ background: card, border: `1.5px solid ${border}` }}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black leading-tight truncate" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>
                          {quiz.title}
                        </h3>
                        <p className="text-[10px] mt-0.5" style={{ color: sub }}>
                          {quiz.questions.length} {quiz.questions.length === 1 ? 'questão' : 'questões'}
                          {quiz.timeLimitMinutes && ` · ${quiz.timeLimitMinutes}min`}
                        </p>
                      </div>
                      {bestScore !== null && (
                        <span className="shrink-0 text-xs font-black px-2 py-0.5 rounded-full"
                          style={{
                            background: bestScore >= 70 ? '#dcfce7' : bestScore >= 50 ? '#fef9c3' : '#fee2e2',
                            color: bestScore >= 70 ? '#15803d' : bestScore >= 50 ? '#92400e' : '#b91c1c',
                            fontFamily: 'Nunito, sans-serif',
                          }}>
                          {bestScore}%
                        </span>
                      )}
                    </div>

                    {/* Question type breakdown */}
                    <div className="flex gap-1.5 mb-3 flex-wrap">
                      {(['multiple', 'single', 'subjective'] as const).map((type) => {
                        const count = quiz.questions.filter((q) => q.type === type).length
                        if (!count) return null
                        const labels = { multiple: 'Múltipla', single: 'Única', subjective: 'Dissertativa' }
                        const colors = { multiple: '#6366f1', single: '#3b82f6', subjective: '#8b5cf6' }
                        return (
                          <span key={type} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-lg"
                            style={{ background: `${colors[type]}18`, color: colors[type], fontFamily: 'Outfit, sans-serif' }}>
                            {count}× {labels[type]}
                          </span>
                        )
                      })}
                    </div>

                    {lastAttempt && (
                      <p className="text-[10px] mb-3" style={{ color: sub }}>
                        Última tentativa: {lastAttempt.score ?? 0}/{lastAttempt.total ?? 0} · {quizAttempts.length} vez{quizAttempts.length !== 1 ? 'es' : ''}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setScreen({ view: 'runner', quiz })}
                        className="flex-1 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-95"
                        style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}
                      >
                        {lastAttempt ? 'Tentar novamente' : 'Iniciar'}
                      </button>
                      <button
                        onClick={() => setScreen({ view: 'editor', quiz })}
                        className="px-3 py-2 rounded-xl hover:bg-black/8 transition-colors"
                        title="Editar" style={{ color: sub, border: `1px solid ${border}` }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        className="px-3 py-2 rounded-xl hover:bg-red-500/10 transition-colors"
                        title="Excluir" style={{ color: '#ef4444', border: `1px solid ${border}` }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
