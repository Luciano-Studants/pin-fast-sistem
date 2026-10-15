import { useEffect, useMemo, useState } from 'react'
import type { QuickLink } from '../../types'
import { newId } from '../../lib/id'

interface Props {
  links: QuickLink[]
  onLinksChange: (links: QuickLink[]) => void
  showToast: (
    msg: string,
    type?: 'success' | 'warning' | 'error' | 'info'
  ) => void
}

/* =========================================================
   URL helpers
   ========================================================= */

const normalizeUrl = (value: string) => {
  const url = value.trim()

  if (!url) return ''

  return /^https?:\/\//i.test(url)
    ? url
    : `https://${url}`
}

// Só permite http(s) em href; qualquer outro esquema (ex.: javascript:) vira "#"
const safeHref = (value: string) =>
  /^https?:\/\//i.test(value.trim()) ? value.trim() : '#'

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

const getOrigin = (url: string) => {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

/* =========================================================
   Favicon cache
   ========================================================= */

const faviconCache = new Map<string, string>()

const getCachedFavicon = (domain: string) => {
  return faviconCache.get(domain)
}

const setCachedFavicon = (domain: string, favicon: string) => {
  faviconCache.set(domain, favicon)
}

/* =========================================================
   Favicon component
   ========================================================= */

interface FaviconProps {
  url: string
  name: string
  size?: number
  fallback?: string
}

function Favicon({
  url,
  name,
  size = 18,
  fallback = '🔗',
}: FaviconProps) {
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url])

  const domain = useMemo(
    () => getDomain(normalizedUrl),
    [normalizedUrl]
  )

  const origin = useMemo(
    () => getOrigin(normalizedUrl),
    [normalizedUrl]
  )

  /*
   * Estratégia:
   *
   * 1. favicon salvo no cache da sessão
   * 2. favicon.ico do próprio site
   * 3. serviço de favicon por domínio
   * 4. emoji de fallback
   */

  const sources = useMemo(() => {
    if (!domain || !origin) return []

    const directFavicon = `${origin}/favicon.ico`

    const domainFavicon =
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`

    return [
      directFavicon,
      domainFavicon,
    ]
  }, [domain, origin])

  const cached = domain
    ? getCachedFavicon(domain)
    : undefined

  const [sourceIndex, setSourceIndex] = useState(
    cached ? -1 : 0
  )

  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)

    const cachedFavicon = domain
      ? getCachedFavicon(domain)
      : undefined

    if (cachedFavicon) {
      setSourceIndex(-1)
    } else {
      setSourceIndex(0)
    }
  }, [domain])

  /*
   * Não temos domínio válido.
   */
  if (!domain || !origin) {
    return (
      <span
        className="shrink-0 flex items-center justify-center"
        style={{
          width: size,
          height: size,
          fontSize: size - 2,
        }}
        aria-hidden="true"
      >
        {fallback}
      </span>
    )
  }

  /*
   * Todas as fontes falharam.
   */
  if (failed || sourceIndex >= sources.length) {
    return (
      <span
        className="shrink-0 flex items-center justify-center"
        style={{
          width: size,
          height: size,
          fontSize: size - 2,
        }}
        title={name}
        aria-hidden="true"
      >
        {fallback}
      </span>
    )
  }

  const src =
    sourceIndex === -1
      ? cached
      : sources[sourceIndex]

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="shrink-0 object-contain"
      onLoad={() => {
        if (src && domain) {
          setCachedFavicon(domain, src)
        }
      }}
      onError={() => {
        /*
         * Tenta a próxima fonte.
         */
        if (sourceIndex < sources.length - 1) {
          setSourceIndex((current) => current + 1)
        } else {
          setFailed(true)
        }
      }}
    />
  )
}

/* =========================================================
   Main component
   ========================================================= */

export default function QuickLinksPanel({
  links,
  onLinksChange,
  showToast,
}: Props) {
  const [adding, setAdding] = useState(false)

  const [form, setForm] = useState({
    name: '',
    url: '',
    color: '#3b82f6',
  })

  const update = (
    key: keyof typeof form,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  /* =======================================================
     Add link
     ======================================================= */

  const addLink = () => {
    const name = form.name.trim()
    const rawUrl = form.url.trim()

    if (!name) {
      showToast('Informe o nome do acesso.', 'warning')
      return
    }

    if (!rawUrl) {
      showToast('Informe a URL do site.', 'warning')
      return
    }

    const url = normalizeUrl(rawUrl)

    /*
     * Validação real da URL.
     */
    try {
      const parsed = new URL(url)

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Protocolo inválido')
      }
    } catch {
      showToast('Digite uma URL válida.', 'warning')
      return
    }

    const link: QuickLink = {
      id: newId(),

      name,

      url,

      color: form.color,

      /*
       * Não precisamos mais salvar um emoji.
       * O favicon será descoberto automaticamente.
       */
    }

    onLinksChange([
      ...links,
      link,
    ])

    setForm({
      name: '',
      url: '',
      color: '#3b82f6',
    })

    setAdding(false)

    showToast(
      'Acesso adicionado!',
      'success'
    )
  }

  /* =======================================================
     Remove link
     ======================================================= */

  const removeLink = (id: string) => {
    onLinksChange(
      links.filter((link) => link.id !== id)
    )
  }

  return (
    <div
      className="size-full p-3 flex flex-col gap-2.5 overflow-y-auto"
      style={{
        fontFamily: 'Outfit, sans-serif',
      }}
    >
      {/* =================================================
          Header
          ================================================= */}

      <div className="flex items-center justify-between shrink-0">
        <p
          className="text-xs font-bold"
          style={{
            color: '#2d1a0a',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          Acessos Rápidos
        </p>

        <button
          onClick={() => setAdding((value) => !value)}
          className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-all hover:opacity-90"
          style={{
            background: '#e07b39',
            color: '#fff',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          + Adicionar
        </button>
      </div>

      {/* =================================================
          Add form
          ================================================= */}

      {adding && (
        <div
          className="flex flex-wrap gap-2 p-2.5 rounded-xl shrink-0"
          style={{
            background: '#f5ede0',
            border: '1.5px solid #e8d5b7',
          }}
        >
          {/* Name */}

          <input
            placeholder="Nome"
            value={form.name}
            onChange={(e) =>
              update('name', e.target.value)
            }
            className="flex-1 min-w-24 px-2 py-1 rounded-lg text-xs outline-none"
            style={{
              border: '1.5px solid #e8d5b7',
              background: '#fff',
              color: '#2d1a0a',
            }}
          />

          {/* URL */}

          <input
            placeholder="URL (ex: youtube.com)"
            value={form.url}
            onChange={(e) =>
              update('url', e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addLink()
              }

              if (e.key === 'Escape') {
                setAdding(false)
              }
            }}
            className="flex-1 min-w-40 px-2 py-1 rounded-lg text-xs outline-none"
            style={{
              border: '1.5px solid #e8d5b7',
              background: '#fff',
              color: '#2d1a0a',
            }}
          />

          {/* Preview */}

          {form.url.trim() && (
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
              style={{
                background: '#fff',
                border: '1.5px solid #e8d5b7',
              }}
            >
              <Favicon
                url={form.url}
                name={form.name || 'Site'}
                size={16}
              />

              <span
                className="text-xs"
                style={{
                  color: '#5a3e28',
                }}
              >
                Pré-visualização
              </span>
            </div>
          )}

          {/* Color */}

          <div className="flex items-center gap-1.5">
            <span
              className="text-xs"
              style={{ color: '#5a3e28' }}
            >
              Cor
            </span>

            <input
              type="color"
              value={form.color}
              onChange={(e) =>
                update('color', e.target.value)
              }
              className="w-7 h-7 cursor-pointer"
            />
          </div>

          {/* Buttons */}

          <div className="flex gap-1.5">
            <button
              onClick={addLink}
              className="px-3 py-1 rounded-lg text-xs font-bold transition-all hover:opacity-90"
              style={{
                background: '#e07b39',
                color: '#fff',
              }}
            >
              Adicionar
            </button>

            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1 rounded-lg text-xs"
              style={{
                background: '#e8d5b7',
                color: '#5a3e28',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* =================================================
          Empty state
          ================================================= */}

      {links.length === 0 && !adding && (
        <p
          style={{
            color: '#c4a47c',
            fontSize: 11,
          }}
        >
          Nenhum acesso rápido ainda.
          Adicione sites, ferramentas e links frequentes.
        </p>
      )}

      {/* =================================================
          Links
          ================================================= */}

      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <div
            key={link.id}
            className="relative group"
          >
            <a
              href={safeHref(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:scale-105 hover:shadow-sm cursor-pointer"
              style={{
                background:
                  (link.color || '#3b82f6') + '18',

                border:
                  `1.5px solid ${
                    link.color || '#3b82f6'
                  }35`,

                color: '#2d1a0a',
              }}
            >
              {/* Favicon */}

              <Favicon
                url={link.url}
                name={link.name}
                size={18}
                fallback={link.icon || '🔗'}
              />

              {/* Name */}

              <span>
                {link.name}
              </span>
            </a>

            {/* Remove */}

            <button
              onClick={() => removeLink(link.id)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: 9,
              }}
              aria-label={`Remover ${link.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}