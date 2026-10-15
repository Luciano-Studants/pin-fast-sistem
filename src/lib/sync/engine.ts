/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiRequest } from "../apiClient"
import * as store from "../store/store"
import { errorMessage, isApiError, isRetryable } from "./errors"
import { RESOURCES, resourceForKey } from "./resources"
import type {
  CollectionResource,
  Resource,
  SingletonResource,
  Snapshot,
  SyncContext,
  SyncStatus,
} from "./types"

// ── Estado observável (indicador na interface) ───────────────────────────────
let status: SyncStatus = { pending: 0, syncing: false, offline: false, error: null }
const statusListeners = new Set<() => void>()

function setStatus(patch: Partial<SyncStatus>) {
  const next = { ...status, ...patch }
  if (
    next.pending === status.pending &&
    next.syncing === status.syncing &&
    next.offline === status.offline &&
    next.error === status.error
  )
    return
  status = next
  statusListeners.forEach((listener) => listener())
}

export function getSyncStatus() {
  return status
}

export function subscribeSyncStatus(listener: () => void) {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

export function clearSyncError() {
  setStatus({ error: null })
}

// ── Sombra (último estado confirmado) ────────────────────────────────────────
type ShadowEntry = [index: number, item: any]

function readCollection(r: CollectionResource) {
  const list = r.toList(store.get(r.key, r.empty))
  const shadow = store.getShadow<ShadowEntry[]>(r.key)
  return { list, shadow: shadow ?? [], hasShadow: shadow !== undefined }
}

interface Plan {
  removes: any[]
  upserts: Array<{ item: any; index: number; previous?: any; previousIndex?: number }>
}

export function planCollection(r: CollectionResource): Plan {
  const { list, shadow } = readCollection(r)
  const shadowById = new Map(shadow.map(([index, item]) => [item.id as string, { index, item }]))
  const currentIds = new Set(list.map((item) => item.id))
  const removes = shadow.filter(([, item]) => !currentIds.has(item.id)).map(([, item]) => item)
  const upserts: Plan["upserts"] = []
  list.forEach((item, index) => {
    const previous = shadowById.get(item.id)
    if (
      previous &&
      JSON.stringify(r.comparable(item, index)) ===
        JSON.stringify(r.comparable(previous.item, previous.index))
    )
      return
    upserts.push({ item, index, previous: previous?.item, previousIndex: previous?.index })
  })
  return { removes, upserts }
}

function singletonValues(r: SingletonResource) {
  return Object.fromEntries(r.keys.map((key) => [key, store.get(key, r.defaults[key])]))
}

export function isDirty(r: Resource): boolean {
  if (r.kind === "collection") {
    const plan = planCollection(r)
    return plan.removes.length > 0 || plan.upserts.length > 0
  }
  const shadow = store.getShadow<Record<string, unknown>>(r.name)
  // Sem sombra e sem nenhum valor local = nada a enviar
  if (shadow === undefined) return r.keys.some((key) => store.has(key))
  const values = singletonValues(r)
  return r.keys.some((key) => JSON.stringify(values[key]) !== JSON.stringify(shadow[key]))
}

function refreshPending() {
  setStatus({ pending: RESOURCES.filter(isDirty).length })
}

// ── Execução ─────────────────────────────────────────────────────────────────
const ctx: SyncContext = {
  patchItem(key, id, fn) {
    const list = store.get<any[]>(key, [])
    let result: any
    const next = list.map((item) => (item.id === id ? (result = fn(item)) : item))
    if (result) store.set(key, next, { sync: false, notify: true })
    return result
  },
}

function report(r: Resource, error: unknown) {
  setStatus({ error: `Não foi possível sincronizar ${r.label}: ${errorMessage(error)}` })
}

async function upsert(r: CollectionResource, entry: Plan["upserts"][number]) {
  const first = entry.previous ? "update" : "create"
  const run = (mode: "create" | "update") =>
    mode === "create"
      ? r.create(entry.item, entry.index, ctx)
      : r.update(entry.item, entry.previous, entry.index, ctx)
  try {
    return await run(first)
  } catch (error) {
    const recoverable =
      isApiError(error) &&
      ((first === "create" && error.status === 409) || (first === "update" && error.status === 404))
    if (recoverable) {
      try {
        return await run(first === "create" ? "update" : "create")
      } catch (second) {
        if (isRetryable(second)) throw second
        report(r, second)
        return undefined
      }
    }
    if (isRetryable(error)) throw error
    // Recusa permanente (dado inválido etc.): descarta a operação e avisa. O próximo
    // carregamento reconcilia com o que o servidor aceitou.
    report(r, error)
    return undefined
  }
}

async function syncCollection(r: CollectionResource) {
  const plan = planCollection(r)
  const { shadow } = readCollection(r)
  const committed = new Map<string, ShadowEntry>(shadow.map((entry) => [entry[1].id, entry]))

  try {
    for (const item of plan.removes) {
      try {
        await r.remove(item)
      } catch (error) {
        if (isRetryable(error)) throw error
        if (!(isApiError(error) && error.status === 404)) report(r, error)
      }
      committed.delete(item.id)
    }
    for (const entry of plan.upserts) {
      const result = await upsert(r, entry)
      const saved = (result ?? entry.item) as any
      committed.set(entry.item.id, [entry.index, r.toShadow ? r.toShadow(saved) : saved])
    }
  } finally {
    const entries = [...committed.values()].sort((a, b) => a[0] - b[0])
    store.setShadow(r.key, entries)
  }
}

async function syncSingleton(r: SingletonResource) {
  const values = singletonValues(r)
  try {
    await r.push(values)
  } catch (error) {
    if (isRetryable(error)) throw error
    report(r, error)
  }
  store.setShadow(r.name, values)
}

// Fila única: respeita a ordem de dependência e evita corridas dentro da aba.
let queue: Promise<unknown> = Promise.resolve()
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

// Evita que duas abas enviem as mesmas alterações ao mesmo tempo.
function withTabLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = (typeof navigator !== "undefined" ? (navigator as any).locks : undefined) as
    | { request<R>(name: string, callback: () => Promise<R>): Promise<R> }
    | undefined
  return locks ? locks.request("pinfast-sync", task) : task()
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()
let retryDelay = 2000
let started = false

function schedule(r: Resource, ms: number) {
  const previous = timers.get(r.name)
  if (previous) clearTimeout(previous)
  timers.set(
    r.name,
    setTimeout(() => {
      timers.delete(r.name)
      void flushResource(r)
    }, ms),
  )
}

/** Envia as pendências de um recurso. Retorna false se precisar tentar de novo. */
export function flushResource(r: Resource): Promise<boolean> {
  return enqueue(() =>
    withTabLock(async () => {
      if (!isDirty(r)) {
        refreshPending()
        return true
      }
      setStatus({ syncing: true })
      try {
        if (r.kind === "collection") await syncCollection(r)
        else await syncSingleton(r)
        retryDelay = 2000
        setStatus({ offline: false })
        return true
      } catch (error) {
        setStatus({ offline: !isApiError(error) })
        schedule(r, retryDelay)
        retryDelay = Math.min(retryDelay * 2, 30_000)
        return false
      } finally {
        setStatus({ syncing: false })
        refreshPending()
      }
    }),
  )
}

export async function flushAll(): Promise<boolean> {
  let ok = true
  for (const r of RESOURCES) {
    const timer = timers.get(r.name)
    if (timer) {
      clearTimeout(timer)
      timers.delete(r.name)
    }
    if (!(await flushResource(r))) ok = false
  }
  return ok
}

function onLocalChange(key: string) {
  const r = resourceForKey(key)
  if (!r) return
  schedule(r, r.debounceMs)
  refreshPending()
}

function onOnline() {
  setStatus({ offline: false })
  void flushAll()
}

export function startSync() {
  if (started) return
  started = true
  store.setChangeHandler(onLocalChange)
  if (typeof window !== "undefined") window.addEventListener("online", onOnline)
  refreshPending()
}

export function stopSync() {
  started = false
  store.setChangeHandler(null)
  timers.forEach((timer) => clearTimeout(timer))
  timers.clear()
  if (typeof window !== "undefined") window.removeEventListener("online", onOnline)
  setStatus({ pending: 0, syncing: false, offline: false, error: null })
}

// ── Hidratação: baixa o estado do servidor para o cache local ────────────────
export async function pullSnapshot(): Promise<{ skipped: string[] }> {
  const snapshot = await apiRequest<Snapshot>("/sync/snapshot")
  const skipped: string[] = []
  for (const r of RESOURCES) {
    if (isDirty(r)) {
      skipped.push(r.name) // mantém alterações locais ainda não enviadas
      continue
    }
    const values = r.pull(snapshot)
    for (const [key, value] of Object.entries(values)) store.set(key, value, { sync: false })
    if (r.kind === "collection") {
      const list = r.toList(values[r.key] ?? r.empty)
      store.setShadow(
        r.key,
        list.map((item, index) => [index, r.toShadow ? r.toShadow(item) : item]),
      )
    } else if (Object.keys(values).length) {
      store.setShadow(r.name, { ...singletonValues(r) })
    }
  }
  refreshPending()
  return { skipped }
}

/** Envia pendências e depois baixa o estado do servidor. Lança erro se o servidor não responder. */
export async function hydrate() {
  await flushAll()
  return pullSnapshot()
}

/** Antes do logout: tenta enviar tudo. Retorna true se não restou nada pendente. */
export async function flushBeforeLogout(timeoutMs = 8000): Promise<boolean> {
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs))
  const done = flushAll().then(() => RESOURCES.every((r) => !isDirty(r)))
  return Promise.race([done, timeout])
}
