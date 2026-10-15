import { useMemo, useState } from "react"
import { useAuth } from "../contexts/AuthContext"
import { ApiError } from "../lib/apiClient"

interface Props {
  mode: "login" | "register" | "forgot" | "reset"
  onSwitch: (mode: string) => void
}

export default function LoginPage({ mode, onSwitch }: Props) {
  const { login, register, forgotPassword, resetPassword } = useAuth()
  const resetToken = useMemo(
    () => new URLSearchParams(window.location.search).get("reset") ?? "",
    [],
  )
  const [info, setInfo] = useState("")
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    confirm: "",
  })
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const update = (k: string, v: string) => {
    setError("")
    setForm((f) => ({ ...f, [k]: v }))
  }

  const handleSubmit = async () => {
    setError("")
    setInfo("")
    setSubmitting(true)
    if (mode === "forgot") {
      try {
        if (!form.email.trim()) throw new Error("Informe seu e-mail.")
        await forgotPassword(form.email.trim())
        setInfo(
          "Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha. Ele vale por 60 minutos.",
        )
      } catch (cause) {
        setError(
          cause instanceof ApiError || cause instanceof Error
            ? cause.message
            : "Não foi possível enviar o e-mail.",
        )
      } finally {
        setSubmitting(false)
      }
      return
    }
    if (mode === "reset") {
      try {
        if (form.password.length < 8)
          throw new Error("A senha deve ter ao menos 8 caracteres.")
        if (form.password !== form.confirm)
          throw new Error("As senhas não coincidem.")
        await resetPassword(resetToken, form.password)
        window.history.replaceState({}, "", window.location.pathname)
        setForm((f) => ({ ...f, password: "", confirm: "" }))
        onSwitch("login")
        setInfo("Senha alterada. Entre com a nova senha.")
      } catch (cause) {
        setError(
          cause instanceof ApiError || cause instanceof Error
            ? cause.message
            : "Não foi possível redefinir a senha.",
        )
      } finally {
        setSubmitting(false)
      }
      return
    }
    if (mode === "login") {
      try {
        if (!form.email.trim())
          throw new Error("Informe seu e-mail ou usuário.")
        if (!form.password) throw new Error("Informe sua senha.")
        await login({ identifier: form.email.trim(), password: form.password })
      } catch (cause) {
        setError(
          cause instanceof ApiError || cause instanceof Error
            ? cause.message
            : "Erro ao entrar. Tente novamente.",
        )
      } finally {
        setSubmitting(false)
      }
    } else {
      try {
        if (!form.firstName.trim()) throw new Error("Informe seu nome.")
        if (!form.email.trim()) throw new Error("Informe um e-mail.")
        if (form.password.length < 8)
          throw new Error("A senha deve ter ao menos 8 caracteres.")
        if (form.password !== form.confirm)
          throw new Error("As senhas não coincidem.")
        await register({
          name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
          email: form.email.trim(),
          username: form.username.trim() || undefined,
          password: form.password,
        })
      } catch (cause) {
        setError(
          cause instanceof ApiError || cause instanceof Error
            ? cause.message
            : "Não foi possível criar sua conta.",
        )
      } finally {
        setSubmitting(false)
      }
    }
  }

  const inputStyle = {
    background: "#fff",
    border: "1.5px solid #e8d5b7",
    fontFamily: "Outfit, sans-serif",
    color: "#2d1a0a",
  }

  return (
    <div
      className="size-full flex"
      style={{ background: "#f5ede0", fontFamily: "Outfit, sans-serif" }}
    >
      {/* Left — illustration panel */}
      <div
        className="hidden lg:flex flex-col items-center justify-center relative overflow-hidden flex-1"
        style={{ background: "#2d1f14" }}
      >
        {/* Cork board */}
        <div className="relative" style={{ width: 340, height: 420 }}>
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #c8a47c 0%, #b8904a 100%)",
              boxShadow:
                "inset 0 2px 10px rgba(0,0,0,0.4), 0 12px 48px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="absolute inset-3 rounded-xl overflow-hidden"
              style={{ border: "6px solid #8b6914", background: "#c09050" }}
            >
              {/* Decorative post-its */}
              {[
                {
                  top: 28,
                  left: 20,
                  color: "#fef9c3",
                  rot: -3,
                  title: "Entregar relatório",
                  sub: "Amanhã, 18h",
                  subColor: "#5a3e28",
                },
                {
                  top: 14,
                  left: 155,
                  color: "#86efac",
                  rot: 2,
                  title: "Reunião TCC",
                  sub: "14:00",
                  subColor: "#14532d",
                },
                {
                  top: 150,
                  left: 60,
                  color: "#93c5fd",
                  rot: -1.5,
                  title: "Estudar React",
                  sub: "",
                  subColor: "",
                },
                {
                  top: 165,
                  left: 195,
                  color: "#fca5a5",
                  rot: 3,
                  title: "Prazo crítico!",
                  sub: "Hoje, 23:59",
                  subColor: "#7f1d1d",
                },
                {
                  top: 280,
                  left: 30,
                  color: "#fdba74",
                  rot: 1,
                  title: "Comprar material",
                  sub: "",
                  subColor: "",
                },
                {
                  top: 270,
                  left: 170,
                  color: "#c4b5fd",
                  rot: -2,
                  title: "Revisão capítulo 3",
                  sub: "Sábado",
                  subColor: "#4c1d95",
                },
              ].map((p, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    top: p.top,
                    left: p.left,
                    transform: `rotate(${p.rot}deg)`,
                  }}
                >
                  <div
                    className="w-28 min-h-[6.5rem] p-2.5 rounded-sm relative"
                    style={{
                      background: p.color,
                      boxShadow: "2px 3px 8px rgba(0,0,0,0.28)",
                    }}
                  >
                    <div
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full"
                      style={{
                        background: "#cc3333",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      }}
                    />
                    <p
                      className="text-xs font-bold leading-snug"
                      style={{ fontFamily: "Kalam, cursive", color: "#1a0f00" }}
                    >
                      {p.title}
                    </p>
                    {p.sub && (
                      <p
                        className="text-xs mt-1 opacity-70"
                        style={{
                          fontFamily: "Kalam, cursive",
                          color: p.subColor || "#1a0f00",
                        }}
                      >
                        {p.sub}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Brand */}
        <div className="mt-10 text-center">
          <p
            className="text-5xl font-black tracking-tight"
            style={{ fontFamily: "Nunito, sans-serif", color: "#f0e6d3" }}
          >
            PIN<span style={{ color: "#e07b39" }}>FAST</span>
          </p>
          <p
            className="mt-2 text-sm"
            style={{
              color: "rgba(240,230,211,0.5)",
              fontFamily: "Outfit, sans-serif",
            }}
          >
            Tudo que você precisa lembrar, na sua frente.
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 lg:max-w-md flex flex-col items-center justify-center px-5 py-6 sm:p-8 overflow-y-auto">
        {/* Mobile brand */}
        <div className="lg:hidden mb-8 text-center">
          <p
            className="text-4xl font-black"
            style={{ fontFamily: "Nunito, sans-serif", color: "#2d1f14" }}
          >
            PIN<span style={{ color: "#e07b39" }}>FAST</span>
          </p>
        </div>

        <div className="w-full max-w-sm">
          <h2
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: "Nunito, sans-serif", color: "#2d1a0a" }}
          >
            {mode === "login"
              ? "Bem-vindo de volta"
              : mode === "register"
                ? "Crie sua conta"
                : mode === "forgot"
                  ? "Recuperar senha"
                  : "Nova senha"}
          </h2>
          <p className="text-sm mb-6" style={{ color: "#7a5c3c" }}>
            {mode === "login"
              ? "Entre no seu quadro."
              : mode === "register"
                ? "Comece a organizar do seu jeito."
                : mode === "forgot"
                  ? "Enviaremos um link para o seu e-mail."
                  : "Escolha uma nova senha para a sua conta."}
          </p>

          <div className="space-y-3">
            {mode === "register" && (
              <>
                <div className="flex gap-2">
                  <input
                    placeholder="Nome"
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300"
                    style={inputStyle}
                  />
                  <input
                    placeholder="Sobrenome"
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300"
                    style={inputStyle}
                  />
                </div>
                <input
                  placeholder="Nome de usuário"
                  value={form.username}
                  onChange={(e) => update("username", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300"
                  style={inputStyle}
                />
              </>
            )}
            {mode !== "reset" && (
              <input
                type={mode === "login" ? "text" : "email"}
                placeholder={mode === "login" ? "E-mail ou usuário" : "E-mail"}
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300"
                style={inputStyle}
              />
            )}
            {mode !== "forgot" && (
              <input
                type="password"
                placeholder={mode === "reset" ? "Nova senha" : "Senha"}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300"
                style={inputStyle}
              />
            )}
            {(mode === "register" || mode === "reset") && (
              <input
                type="password"
                placeholder="Confirmar senha"
                value={form.confirm}
                onChange={(e) => update("confirm", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300"
                style={inputStyle}
              />
            )}
          </div>

          {mode === "login" && (
            <p className="text-right mt-2 text-xs">
              <button
                onClick={() => onSwitch("forgot")}
                className="font-semibold hover:underline"
                style={{ color: "#e07b39" }}
              >
                Esqueci minha senha
              </button>
            </p>
          )}

          {info && (
            <div
              className="mt-3 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{
                background: "rgba(63,143,98,0.12)",
                color: "#3f8f62",
                border: "1px solid rgba(63,143,98,0.25)",
                fontFamily: "Outfit, sans-serif",
              }}
            >
              {info}
            </div>
          )}

          {error && (
            <div
              className="mt-3 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{
                background: "rgba(239,68,68,0.1)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.2)",
                fontFamily: "Outfit, sans-serif",
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="w-full mt-5 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95 disabled:cursor-wait disabled:opacity-60"
            style={{
              background: "#e07b39",
              color: "#fff",
              fontFamily: "Nunito, sans-serif",
              letterSpacing: "0.025em",
            }}
          >
            {submitting
              ? "Aguarde…"
              : mode === "login"
                ? "Entrar"
                : mode === "register"
                  ? "Criar conta"
                  : mode === "forgot"
                    ? "Enviar link"
                    : "Salvar nova senha"}
          </button>

          <p className="text-center mt-4 text-sm" style={{ color: "#7a5c3c" }}>
            {mode === "login"
              ? "Não tem uma conta? "
              : mode === "register"
                ? "Já tem uma conta? "
                : "Lembrou a senha? "}
            <button
              onClick={() => onSwitch(mode === "login" ? "register" : "login")}
              className="font-semibold hover:underline"
              style={{ color: "#e07b39" }}
            >
              {mode === "login" ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
