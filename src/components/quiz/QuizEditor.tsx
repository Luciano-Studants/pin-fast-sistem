import { useState } from 'react'
import type { Quiz, QuizQuestion, QuizChoice, QuestionType } from '../../types'

function uid() { return Math.random().toString(36).slice(2) }

function emptyChoice(): QuizChoice { return { id: uid(), text: '', correct: false } }

function emptyQuestion(type: QuestionType = 'multiple'): QuizQuestion {
  return {
    id: uid(),
    type,
    prompt: '',
    choices: type === 'subjective' ? [] : [emptyChoice(), emptyChoice()],
    correctAnswer: '',
    subjectiveAnswer: '',
  }
}

interface Props {
  quiz?: Quiz
  darkMode: boolean
  onSave: (q: Quiz) => void
  onCancel: () => void
}

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple: 'Múltipla escolha',
  single: 'Resposta curta',
  subjective: 'Dissertativa',
}

export default function QuizEditor({ quiz, darkMode, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(quiz?.title ?? '')
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | null>(quiz?.timeLimitMinutes ?? null)
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    quiz?.questions.length ? quiz.questions : [emptyQuestion()]
  )

  const dm = darkMode
  const bg = dm ? '#161210' : '#f5ede0'
  const card = dm ? '#1e1a16' : '#fff'
  const border = dm ? '#2e2820' : '#e8d5b7'
  const text = dm ? '#f0e6d3' : '#2d1a0a'
  const sub = dm ? '#8a7a6a' : '#9a7a5a'
  const accent = '#e07b39'
  const inputSt = {
    background: dm ? '#252018' : '#fff',
    color: text,
    border: `1px solid ${border}`,
    fontFamily: 'Outfit, sans-serif',
    outline: 'none',
  }

  // --- question helpers ---
  const setQ = (idx: number, patch: Partial<QuizQuestion>) =>
    setQuestions((qs) => qs.map((q, i) => i === idx ? { ...q, ...patch } : q))

  const addQuestion = (type: QuestionType) =>
    setQuestions((qs) => [...qs, emptyQuestion(type)])

  const removeQuestion = (idx: number) =>
    setQuestions((qs) => qs.filter((_, i) => i !== idx))

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    setQuestions((qs) => {
      const arr = [...qs]
      const target = idx + dir
      if (target < 0 || target >= arr.length) return arr
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return arr
    })
  }

  // --- choice helpers ---
  const setChoice = (qIdx: number, cIdx: number, patch: Partial<QuizChoice>) =>
    setQ(qIdx, {
      choices: questions[qIdx].choices.map((c, i) => i === cIdx ? { ...c, ...patch } : c),
    })

  const addChoice = (qIdx: number) =>
    setQ(qIdx, { choices: [...questions[qIdx].choices, emptyChoice()] })

  const removeChoice = (qIdx: number, cIdx: number) =>
    setQ(qIdx, { choices: questions[qIdx].choices.filter((_, i) => i !== cIdx) })

  const toggleCorrect = (qIdx: number, cIdx: number) => {
    const q = questions[qIdx]
    if (q.type === 'multiple') {
      setChoice(qIdx, cIdx, { correct: !q.choices[cIdx].correct })
    } else {
      // single-correct: only one can be correct
      setQ(qIdx, {
        choices: q.choices.map((c, i) => ({ ...c, correct: i === cIdx })),
      })
    }
  }

  const changeType = (qIdx: number, type: QuestionType) => {
    const q = questions[qIdx]
    setQ(qIdx, {
      type,
      choices: type === 'subjective' ? [] : q.choices.length >= 2 ? q.choices : [emptyChoice(), emptyChoice()],
    })
  }

  const validate = () => {
    if (!title.trim()) return 'Dê um título ao questionário.'
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.prompt.trim()) return `Questão ${i + 1}: escreva o enunciado.`
      if (q.type === 'multiple' || q.type === 'single') {
        if (q.choices.some((c) => !c.text.trim())) return `Questão ${i + 1}: preencha todas as alternativas.`
        if (!q.choices.some((c) => c.correct)) return `Questão ${i + 1}: marque pelo menos uma resposta correta.`
      }
    }
    return null
  }

  const handleSave = () => {
    const err = validate()
    if (err) { alert(err); return }
    const now = new Date().toISOString()
    onSave({
      id: quiz?.id ?? uid(),
      title: title.trim(),
      questions,
      timeLimitMinutes,
      createdAt: quiz?.createdAt ?? now,
      updatedAt: now,
    })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: bg }}>
      {/* Header */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 shrink-0 flex items-center justify-between gap-2" style={{ borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 20 }}>📝</span>
          <h2 className="text-base font-black" style={{ color: text, fontFamily: 'Nunito, sans-serif' }}>
            {quiz ? 'Editar questionário' : 'Novo questionário'}
          </h2>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: dm ? '#2e2820' : '#f0e6d3', color: sub, fontFamily: 'Nunito, sans-serif' }}>
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
            style={{ background: accent, color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
            Salvar questionário
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 space-y-5">
        {/* Title + time */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-start">
          <div className="flex-1">
            <label className="block text-xs font-bold mb-1" style={{ color: sub, fontFamily: 'Nunito, sans-serif' }}>Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl"
              style={inputSt}
              placeholder="Ex: Revisão de Banco de Dados"
            />
          </div>
          <div className="w-full sm:w-44 shrink-0">
            <label className="block text-xs font-bold mb-1" style={{ color: sub, fontFamily: 'Nunito, sans-serif' }}>
              Tempo limite
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={300}
                value={timeLimitMinutes ?? ''}
                onChange={(e) => setTimeLimitMinutes(e.target.value ? Number(e.target.value) : null)}
                className="flex-1 text-sm px-3 py-2 rounded-xl"
                style={inputSt}
                placeholder="minutos"
              />
              {timeLimitMinutes !== null && (
                <button onClick={() => setTimeLimitMinutes(null)}
                  className="text-xs px-2 py-2 rounded-xl hover:opacity-80"
                  style={{ color: sub, background: dm ? '#2e2820' : '#f0e6d3' }}
                  title="Sem limite">✕</button>
              )}
            </div>
            <p className="text-[10px] mt-1" style={{ color: sub }}>Deixe vazio para sem limite</p>
          </div>
        </div>

        {/* Questions */}
        {questions.map((q, qIdx) => (
          <div key={q.id} className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${border}`, background: card }}>
            {/* Question header */}
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${border}`, background: dm ? '#252018' : '#fdf8f2' }}>
              <span className="text-xs font-black shrink-0" style={{ color: accent, fontFamily: 'Nunito, sans-serif' }}>
                Q{qIdx + 1}
              </span>
              <select
                value={q.type}
                onChange={(e) => changeType(qIdx, e.target.value as QuestionType)}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ ...inputSt, fontFamily: 'Outfit, sans-serif', fontSize: 11 }}
              >
                {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
              <div className="flex gap-1 ml-auto">
                <button onClick={() => moveQuestion(qIdx, -1)} disabled={qIdx === 0}
                  className="p-1 rounded-lg hover:bg-black/8 disabled:opacity-20 transition-colors"
                  style={{ color: sub }} title="Mover para cima">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button onClick={() => moveQuestion(qIdx, 1)} disabled={qIdx === questions.length - 1}
                  className="p-1 rounded-lg hover:bg-black/8 disabled:opacity-20 transition-colors"
                  style={{ color: sub }} title="Mover para baixo">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <button onClick={() => removeQuestion(qIdx)} disabled={questions.length === 1}
                  className="p-1 rounded-lg hover:bg-red-500/10 disabled:opacity-20 transition-colors"
                  style={{ color: '#ef4444' }} title="Remover questão">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Prompt */}
              <textarea
                value={q.prompt}
                onChange={(e) => setQ(qIdx, { prompt: e.target.value })}
                rows={2}
                className="w-full text-sm px-3 py-2 rounded-xl resize-none"
                style={inputSt}
                placeholder="Enunciado da questão…"
              />

              {/* Choices (multiple / single) */}
              {(q.type === 'multiple' || q.type === 'single') && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold" style={{ color: sub }}>
                    {q.type === 'multiple' ? 'Alternativas (marque as corretas)' : 'Alternativas (marque a única correta)'}
                  </p>
                  {q.choices.map((c, cIdx) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <button
                        onClick={() => toggleCorrect(qIdx, cIdx)}
                        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all"
                        style={{
                          border: `2px solid ${c.correct ? '#22c55e' : border}`,
                          background: c.correct ? '#22c55e' : 'transparent',
                        }}
                        title="Marcar como correta"
                      >
                        {c.correct && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </button>
                      <input
                        value={c.text}
                        onChange={(e) => setChoice(qIdx, cIdx, { text: e.target.value })}
                        className="flex-1 text-xs px-2.5 py-1.5 rounded-lg"
                        style={inputSt}
                        placeholder={`Alternativa ${String.fromCharCode(65 + cIdx)}`}
                      />
                      <button onClick={() => removeChoice(qIdx, cIdx)} disabled={q.choices.length <= 2}
                        className="shrink-0 p-1 rounded-lg hover:bg-red-500/10 disabled:opacity-20 transition-colors"
                        style={{ color: '#ef4444' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                  {q.choices.length < 6 && (
                    <button onClick={() => addChoice(qIdx)}
                      className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg hover:opacity-80 transition-opacity"
                      style={{ color: accent, fontFamily: 'Outfit, sans-serif' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Adicionar alternativa
                    </button>
                  )}
                </div>
              )}

              {/* Subjective answer */}
              {q.type === 'subjective' && (
                <div>
                  <p className="text-[10px] font-bold mb-1" style={{ color: sub }}>Resposta modelo (opcional)</p>
                  <textarea
                    value={q.subjectiveAnswer ?? ''}
                    onChange={(e) => setQ(qIdx, { subjectiveAnswer: e.target.value })}
                    rows={2}
                    className="w-full text-xs px-3 py-2 rounded-xl resize-none"
                    style={{ ...inputSt, opacity: 0.8 }}
                    placeholder="Escreva a resposta esperada para comparação…"
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Add question buttons */}
        <div className="flex flex-wrap gap-2 pb-4">
          {(Object.keys(TYPE_LABELS) as QuestionType[]).map((type) => (
            <button key={type} onClick={() => addQuestion(type)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
              style={{ border: `1.5px dashed ${border}`, color: sub, background: 'transparent', fontFamily: 'Outfit, sans-serif' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
