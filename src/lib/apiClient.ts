const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1"
).replace(/\/$/, "")

let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

async function readResponse(response: Response) {
  if (response.status === 204) return undefined
  const contentType = response.headers.get("content-type") || ""
  return contentType.includes("application/json")
    ? response.json()
    : response.text()
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    if (!response.ok) {
      setAccessToken(null)
      return null
    }
    const data = await response.json()
    setAccessToken(data.accessToken)
    return data.accessToken as string
  })().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  retryAuth?: boolean
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, retryAuth = true, headers, ...init } = options
  const isFormData = body instanceof FormData
  const requestHeaders = new Headers(headers)
  if (!isFormData && body !== undefined)
    requestHeaders.set("content-type", "application/json")
  if (accessToken) requestHeaders.set("authorization", `Bearer ${accessToken}`)

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: requestHeaders,
    body:
      body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  })

  if (response.status === 401 && retryAuth && !path.startsWith("/auth/")) {
    const token = await refreshAccessToken()
    if (token) return apiRequest<T>(path, { ...options, retryAuth: false })
  }

  const data = await readResponse(response)
  if (!response.ok) {
    const payload =
      typeof data === "object" && data ? data as Record<string, unknown> : {}
    throw new ApiError(
      response.status,
      typeof payload.message === "string"
        ? payload.message
        : "Não foi possível concluir a solicitação.",
      typeof payload.error === "string" ? payload.error : undefined,
      payload.details,
    )
  }
  return data as T
}

export async function restoreAccessToken() {
  return refreshAccessToken()
}
