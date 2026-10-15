/* eslint-disable @typescript-eslint/no-explicit-any */
export type Snapshot = Record<string, any>

export interface SyncContext {
  /** Altera um item da lista local sem agendar nova sincronização (ex.: trocar anexo local por anexo do servidor). */
  patchItem<T extends { id: string }>(key: string, id: string, fn: (item: T) => T): T | undefined
}

interface BaseResource {
  name: string
  label: string
  debounceMs: number
  /** Converte o snapshot do servidor em valores das chaves locais. */
  pull(snapshot: Snapshot): Record<string, unknown>
}

export interface CollectionResource<L extends { id: string } = any> extends BaseResource {
  kind: "collection"
  key: string
  empty: unknown
  /** Lista plana de itens a partir do valor guardado na chave local. */
  toList(value: any): L[]
  /** Parte do item que importa para decidir se mudou (inclui posição quando relevante). */
  comparable(item: L, index: number): unknown
  create(item: L, index: number, ctx: SyncContext): Promise<L | void>
  /** `previous` indefinido = enviar o item completo. */
  update(item: L, previous: L | undefined, index: number, ctx: SyncContext): Promise<L | void>
  remove(item: L): Promise<void>
  /** Versão do item guardada na sombra (sem dados pesados). */
  toShadow?(item: L): L
}

export interface SingletonResource extends BaseResource {
  kind: "singleton"
  keys: string[]
  defaults: Record<string, unknown>
  push(values: Record<string, unknown>): Promise<void>
}

export type Resource = CollectionResource | SingletonResource

export interface SyncStatus {
  /** Recursos com alterações ainda não confirmadas pelo servidor. */
  pending: number
  syncing: boolean
  offline: boolean
  /** Última recusa permanente do servidor (ex.: dado inválido). */
  error: string | null
}
