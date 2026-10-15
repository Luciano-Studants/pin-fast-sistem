import { useState, useEffect, lazy, Suspense, Component } from "react"
import type { ReactNode } from "react"
import SplashScreen from "./components/SplashScreen"
import { AuthProvider, useAuth } from "./contexts/AuthContext"

class ErrorBoundary extends Component<{ children: ReactNode }, {
  error: boolean
}> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    if (this.state.error)
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: 16,
            fontFamily: "Outfit, sans-serif",
            background: "#f5ede0",
            color: "#2d1a0a",
          }}
        >
          <span style={{ fontSize: 40 }}>⚠️</span>
          <p style={{ fontWeight: 700, fontSize: 16 }}>
            Algo deu errado ao carregar
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#e07b39",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "8px 24px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Recarregar página
          </button>
        </div>
      )
    return this.props.children
  }
}

const LoginPage = lazy(() => import("./components/LoginPage"))
const MainApp = lazy(() => import("./components/MainApp"))
const MigrationGate = lazy(() => import("./components/migration/MigrationGate"))
const SyncGate = lazy(() => import("./components/sync/SyncGate"))

type Screen = "login" | "register" | "forgot" | "reset"

function AppContent() {
  const [screen, setScreen] = useState<Screen>(() =>
    new URLSearchParams(window.location.search).get("reset") ? "reset" : "login",
  )
  const [ready, setReady] = useState(false)
  const { user, status, logout } = useAuth()

  // Brief mount delay lets fonts + CSS settle before first paint
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 320)
    return () => clearTimeout(t)
  }, [])

  if (!ready || status === "checking") return <SplashScreen />

  if (user) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<SplashScreen label="Entrando no quadro…" />}>
          <MigrationGate>
            <SyncGate>
              <MainApp onLogout={() => void logout()} />
            </SyncGate>
          </MigrationGate>
        </Suspense>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<SplashScreen />}>
        <LoginPage mode={screen} onSwitch={(s) => setScreen(s as Screen)} />
      </Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
