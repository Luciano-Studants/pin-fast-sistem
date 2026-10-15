interface Props {
  message: string
  type: 'success' | 'warning' | 'error' | 'info'
}

const TYPE_STYLES = {
  success: { bg: '#22c55e', icon: '✓' },
  warning: { bg: '#e07b39', icon: '⚠' },
  error: { bg: '#ef4444', icon: '✕' },
  info: { bg: '#6366f1', icon: 'ℹ' },
}

export default function Toast({ message, type }: Props) {
  const s = TYPE_STYLES[type] ?? TYPE_STYLES['info']
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-medium"
      style={{
        background: s.bg,
        color: '#fff',
        fontFamily: 'Outfit, sans-serif',
        animation: 'slideIn 0.2s ease',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      }}
    >
      <span className="font-bold text-base leading-none">{s.icon}</span>
      {message}
    </div>
  )
}
