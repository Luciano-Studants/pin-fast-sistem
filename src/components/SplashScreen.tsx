export default function SplashScreen({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div
      className="size-full flex flex-col items-center justify-center gap-4"
      style={{ background: '#f5ede0', fontFamily: 'Nunito, sans-serif' }}
    >
      {/* Cork board mini logo */}
      <div
        className="relative flex items-center justify-center rounded-2xl"
        style={{
          width: 72,
          height: 72,
          background: 'linear-gradient(135deg, #c8a47c 0%, #b8904a 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
        }}
      >
        <span style={{ fontSize: 34 }}>📌</span>
        {/* Spinning ring */}
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            border: '3px solid transparent',
            borderTopColor: '#e07b39',
            borderRightColor: '#e07b39',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>

      <div className="flex flex-col items-center gap-1">
        <span
          className="text-lg font-black"
          style={{ color: '#2d1a0a', letterSpacing: -0.5 }}
        >
          PINFAST
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: '#9a7a5a', fontFamily: 'Outfit, sans-serif' }}
        >
          {label}
        </span>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
