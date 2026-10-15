import { useRef } from 'react'
import type { PostItAttachment } from '../../types'
import { newId } from '../../lib/id'

const MAX_SIZE_MB = 8

function fileIcon(mime: string, name: string): string {
  if (mime.startsWith('image/')) return '🖼'
  if (mime === 'application/pdf') return '📄'
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'xlsx' || ext === 'xls' || mime.includes('spreadsheet') || mime.includes('excel')) return '📊'
  if (ext === 'docx' || ext === 'doc' || mime.includes('word')) return '📋'
  if (ext === 'txt' || mime === 'text/plain') return '📝'
  return '📎'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  attachments: PostItAttachment[]
  onChange: (attachments: PostItAttachment[]) => void
  readonly?: boolean
}

export default function AttachmentsPanel({ attachments, onChange, readonly }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        alert(`"${file.name}" excede ${MAX_SIZE_MB}MB e não foi anexado.`)
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        const data = e.target?.result as string
        const attachment: PostItAttachment = {
          id: newId(),
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          data,
        }
        onChange([...attachments, attachment])
      }
      reader.readAsDataURL(file)
    })
  }

  const remove = (id: string) => onChange(attachments.filter((a) => a.id !== id))

  const download = (a: PostItAttachment) => {
    const link = document.createElement('a')
    link.href = a.url ?? a.data ?? '#'
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.download = a.name
    link.click()
  }

  const labelColor = 'rgba(26,15,0,0.5)'
  const borderColor = 'rgba(26,15,0,0.15)'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-bold uppercase tracking-wide" style={{ color: labelColor, fontFamily: 'Outfit, sans-serif', fontSize: 10 }}>
          Anexos {attachments.length > 0 && `(${attachments.length})`}
        </label>
        {!readonly && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg hover:opacity-80 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.08)', color: '#5a3e28', fontFamily: 'Outfit, sans-serif' }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Anexar
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {attachments.length === 0 && !readonly && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
          className="w-full flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-opacity hover:opacity-70"
          style={{ border: `1.5px dashed ${borderColor}`, background: 'rgba(0,0,0,0.03)', color: labelColor }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
          <span className="text-[10px] font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>Soltar arquivo ou clicar</span>
          <span className="text-[9px] opacity-60" style={{ fontFamily: 'Outfit, sans-serif' }}>Imagem, PDF, TXT, Excel, Word · máx {MAX_SIZE_MB}MB</span>
        </button>
      )}

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-xl px-2.5 py-2 group"
              style={{ background: 'rgba(0,0,0,0.06)', border: `1px solid ${borderColor}` }}
            >
              {/* Preview or icon */}
              {a.mimeType.startsWith('image/') ? (
                <img
                  src={a.url ?? a.data}
                  alt={a.name}
                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                  style={{ border: `1px solid ${borderColor}` }}
                />
              ) : (
                <span className="text-base shrink-0 w-8 text-center">{fileIcon(a.mimeType, a.name)}</span>
              )}

              {/* Name + size */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: '#1a0f00', fontFamily: 'Outfit, sans-serif' }}>{a.name}</p>
                <p className="text-[9px]" style={{ color: a.syncError ? '#d95c4f' : labelColor, fontFamily: 'Outfit, sans-serif' }}>
                  {a.syncError ? `⚠ Não enviado: ${a.syncError}` : `${formatSize(a.size)}${a.url ? '' : ' · enviando…'}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => download(a)}
                  className="p-1 rounded-lg hover:bg-black/10 transition-colors"
                  title="Baixar"
                  style={{ color: '#5a3e28' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </button>
                {!readonly && (
                  <button
                    onClick={() => remove(a.id)}
                    className="p-1 rounded-lg hover:bg-red-500/15 transition-colors"
                    title="Remover"
                    style={{ color: '#ef4444' }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}

          {!readonly && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1 text-[10px] font-semibold hover:opacity-70 transition-opacity"
              style={{ color: labelColor, fontFamily: 'Outfit, sans-serif' }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Adicionar mais
            </button>
          )}
        </div>
      )}
    </div>
  )
}
