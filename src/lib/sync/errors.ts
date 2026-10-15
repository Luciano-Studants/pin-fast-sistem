import { ApiError } from "../apiClient"

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** Falhas temporárias (rede, servidor, sessão): a operação deve ser repetida depois. */
export function isRetryable(error: unknown): boolean {
  if (!isApiError(error)) return true
  return (
    error.status === 401 ||
    error.status === 408 ||
    error.status === 425 ||
    error.status === 429 ||
    error.status >= 500
  )
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido"
}
