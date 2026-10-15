import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
  apiRequest,
  restoreAccessToken,
  setAccessToken,
} from "../lib/apiClient"
import { flushBeforeLogout } from "../lib/sync/engine"
import * as store from "../lib/store/store"

export interface AuthUser {
  id: string
  email: string
  username: string | null
  name: string
  avatarUrl: string | null
}

interface LoginInput {
  identifier: string
  password: string
}

interface RegisterInput {
  name: string
  email: string
  username?: string
  password: string
}

interface AuthContextValue {
  user: AuthUser | null
  status: "checking" | "authenticated" | "unauthenticated"
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (token: string, newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function sanitizeLegacyProfile(user: AuthUser) {
  try {
    const existing = JSON.parse(localStorage.getItem("user-profile-v1") || "{}")
    localStorage.setItem(
      "user-profile-v1",
      JSON.stringify({
        ...existing,
        name: user.name,
        email: user.email,
        username: user.username ?? "",
        password: undefined,
      }),
    )
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthContextValue["status"]>("checking")

  useEffect(() => {
    let active = true
    const restore = async () => {
      try {
        const token = await restoreAccessToken()
        if (!token) throw new Error("No session")
        const response = await apiRequest<{ user: AuthUser }>("/auth/me")
        if (!active) return
        setUser(response.user)
        sanitizeLegacyProfile(response.user)
        setStatus("authenticated")
      } catch {
        if (!active) return
        setAccessToken(null)
        setStatus("unauthenticated")
      }
    }
    void restore()
    return () => {
      active = false
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      async login(input) {
        const response = await apiRequest<{
          user: AuthUser
          accessToken: string
        }>("/auth/login", {
          method: "POST",
          body: input,
          retryAuth: false,
        })
        setAccessToken(response.accessToken)
        setUser(response.user)
        sanitizeLegacyProfile(response.user)
        setStatus("authenticated")
      },
      async register(input) {
        const response = await apiRequest<{
          user: AuthUser
          accessToken: string
        }>("/auth/register", {
          method: "POST",
          body: input,
          retryAuth: false,
        })
        setAccessToken(response.accessToken)
        setUser(response.user)
        sanitizeLegacyProfile(response.user)
        setStatus("authenticated")
      },
      async forgotPassword(email) {
        await apiRequest("/auth/forgot-password", {
          method: "POST",
          body: { email },
          retryAuth: false,
        })
      },
      async resetPassword(token, newPassword) {
        await apiRequest("/auth/reset-password", {
          method: "POST",
          body: { token, newPassword },
          retryAuth: false,
        })
      },
      async logout() {
        // Envia o que falta enquanto a sessão ainda é válida; só limpa o cache local se tudo foi salvo.
        const userId = store.getScope()
        let allSynced = false
        try {
          allSynced = await flushBeforeLogout()
        } catch {
          allSynced = false
        }
        if (userId && allSynced) store.clearScope(userId)
        try {
          await apiRequest("/auth/logout", {
            method: "POST",
            body: {},
            retryAuth: false,
          })
        } finally {
          setAccessToken(null)
          setUser(null)
          setStatus("unauthenticated")
        }
      },
    }),
    [status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside AuthProvider")
  return value
}
