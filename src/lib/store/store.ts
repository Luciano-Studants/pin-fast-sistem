/**
 * Armazenamento local por usuário. O cache fica em `pinfast:<userId>:<chave>` para que
 * contas diferentes no mesmo navegador nunca enxerguem os dados umas das outras.
 * A sincronização com a API é feita pelo motor em `../sync/engine.ts`.
 */
const PREFIX = "pinfast"

let scope: string | null = null
const listeners = new Map<string, Set<() => void>>()
let changeHandler: ((key: string) => void) | null = null

export function setScope(userId: string | null) {
  scope = userId
}

export function getScope() {
  return scope
}

function fullKey(key: string) {
  return `${PREFIX}:${scope}:${key}`
}

function readRaw(key: string): string | null {
  if (!scope) return null
  try {
    return localStorage.getItem(fullKey(key))
  } catch {
    return null
  }
}

function writeRaw(key: string, raw: string) {
  if (!scope) return
  try {
    localStorage.setItem(fullKey(key), raw)
  } catch {
    // cota do navegador excedida: o dado continua em memória na tela
  }
}

export function has(key: string): boolean {
  return readRaw(key) !== null
}

export function get<T>(key: string, fallback: T): T {
  const raw = readRaw(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function getRaw(key: string): string | null {
  return readRaw(key)
}

interface SetOptions {
  /** Avisa assinantes (hooks) da mudança. Use false quando o próprio hook originou a escrita. */
  notify?: boolean
  /** Agenda sincronização com a API. */
  sync?: boolean
}

export function set(key: string, value: unknown, options: SetOptions = {}) {
  const { notify = true, sync = true } = options
  writeRaw(key, JSON.stringify(value))
  if (notify) emit(key)
  if (sync) changeHandler?.(key)
}

export function remove(key: string) {
  if (!scope) return
  try {
    localStorage.removeItem(fullKey(key))
  } catch {
    // ignore
  }
}

/** Sombra = último estado confirmado pelo servidor. Diferença entre valor atual e sombra = pendente. */
export function getShadow<T>(key: string): T | undefined {
  const raw = readRaw(`shadow:${key}`)
  if (raw === null) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export function setShadow(key: string, value: unknown) {
  writeRaw(`shadow:${key}`, JSON.stringify(value))
}

export function subscribe(key: string, listener: () => void): () => void {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(listener)
  return () => {
    set?.delete(listener)
  }
}

function emit(key: string) {
  listeners.get(key)?.forEach((listener) => listener())
}

export function setChangeHandler(handler: ((key: string) => void) | null) {
  changeHandler = handler
}

/** Remove todo o cache do usuário (usado no logout quando não há pendências). */
export function clearScope(userId: string) {
  try {
    const prefix = `${PREFIX}:${userId}:`
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // ignore
  }
}
