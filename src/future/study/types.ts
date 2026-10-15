export interface StudySubject {
  id: string
  name: string
  color: string
  icon: string
  description?: string
  professor?: string
  institution?: string
  semester?: string
  hoursGoal: number
  minutesStudied: number
  sessions: number
  createdAt: string
}

export interface StudySession {
  id: string
  subjectId: string
  subjectName: string
  subjectColor: string
  subjectIcon: string
  minutesStudied: number
  startedAt: string
  finishedAt: string
  preset: string
}

export interface StudyGoal {
  id: string
  type: 'daily' | 'weekly' | 'monthly'
  targetMinutes: number
  label: string
}

export interface StudyProfile {
  xp: number
  streak: number
  bestStreak: number
  lastActiveDate: string
  totalMinutesStudied: number
  totalSessions: number
  loginDates: string[]
  achievements: string[]
}
