export interface PostItAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  data?: string  // base64 data URL (somente até o upload ao servidor)
  url?: string   // URL pública no armazenamento (após o upload)
  syncError?: string  // motivo pelo qual o envio foi recusado
}

export interface PostIt {
  id: string
  title: string
  description?: string
  dueDate?: string
  dueTime?: string
  color: string
  x: number
  y: number
  completed: boolean
  completedAt?: string
  deleted: boolean
  createdAt: string
  attachments?: PostItAttachment[]
}

export interface Note {
  id: string
  title?: string
  content: string
  color: string
  createdAt: string
}

export interface QuickLink {
  id: string
  name: string
  url: string
  icon?: string
  color?: string
}

export interface Workspace {
  id: string
  name: string
  color: string
  icon: string
  description?: string
}

export interface CollabSpace {
  id: string
  name: string
  color: string
  members: string[]
}

export interface SpreadsheetCell {
  v: string
  bold?: boolean
  italic?: boolean
  align?: 'left' | 'center' | 'right'
  color?: string
  bg?: string
  fmt?: 'text' | 'number' | 'currency' | 'percent'
}

export interface Spreadsheet {
  id: string
  title: string
  cells: Record<string, SpreadsheetCell>
  colWidths: Record<number, number>
  createdAt: string
  updatedAt: string
  subjectId?: string
}

export type QuestionType = 'multiple' | 'single' | 'subjective'

export interface QuizChoice {
  id: string
  text: string
  correct: boolean
}

export interface QuizQuestion {
  id: string
  type: QuestionType
  prompt: string
  choices: QuizChoice[]      // for 'multiple' and 'single'
  correctAnswer?: string     // for 'single' short-answer
  subjectiveAnswer?: string  // author's model answer for 'subjective'
}

export interface Quiz {
  id: string
  title: string
  questions: QuizQuestion[]
  timeLimitMinutes: number | null
  createdAt: string
  updatedAt: string
}

export interface QuizAttemptAnswer {
  questionId: string
  selectedChoiceIds?: string[]
  textAnswer?: string
  selfScore?: boolean        // for subjective: user marks if they got it right
}

export interface QuizAttempt {
  id: string
  quizId: string
  answers: QuizAttemptAnswer[]
  startedAt: string
  finishedAt?: string
  score?: number
  total?: number
}

export interface TextDocument {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  subjectId?: string
}
