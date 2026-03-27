type Props = { message: string | null }

export function Toast({ message }: Props) {
  if (!message) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-zinc-800 border border-white/10 px-4 py-2 text-sm text-zinc-100 shadow-xl animate-in fade-in slide-in-from-bottom-2"
    >
      {message}
    </div>
  )
}
