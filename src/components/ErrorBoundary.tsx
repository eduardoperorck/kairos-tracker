import { Component, type ReactNode, type ErrorInfo } from 'react'
import { useI18n } from '../i18n'

type Props = { children: ReactNode }
type State = { error: Error | null; info: string }

async function writeErrorLog(content: string): Promise<void> {
  try {
    const { writeTextFile, BaseDirectory } = await import(/* @vite-ignore */ '@tauri-apps/plugin-fs')
    const timestamp = new Date().toISOString().slice(0, 10)
    await writeTextFile(`crash-${timestamp}.log`, content, { baseDir: BaseDirectory.AppLog })
  } catch {
    // Not in Tauri or FS unavailable — skip silently
  }
}

// ─── ErrorDisplay ─────────────────────────────────────────────────────────────

// Fallback strings keyed by lang, used when the i18n context returns raw keys
// (which happens when the I18nProvider itself is part of the crashed subtree).
const FALLBACK: Record<'en' | 'pt', { title: string; detail: string; reload: string; copy: string }> = {
  en: {
    title: 'Something went wrong',
    detail: 'An error occurred and could not be recovered.',
    reload: 'Reload app',
    copy: 'Copy error details',
  },
  pt: {
    title: 'Algo deu errado',
    detail: 'Ocorreu um erro e não foi possível recuperar.',
    reload: 'Recarregar app',
    copy: 'Copiar detalhes do erro',
  },
}

function ErrorDisplay({ error, info }: { error: Error; info: string }) {
  const { t } = useI18n()

  // If the context is broken, t('error.title') returns the raw key string.
  // Detect this and fall back to hardcoded strings.
  const contextWorking = t('error.title') !== 'error.title'
  const localLang = (localStorage.getItem('lang') === 'pt' ? 'pt' : 'en') as 'en' | 'pt'
  const fb = FALLBACK[localLang]

  const title = contextWorking ? t('error.title') : fb.title
  const detail = contextWorking ? t('error.detail') : fb.detail
  const reloadLabel = contextWorking ? t('error.reload') : fb.reload
  const copyLabel = contextWorking ? t('error.copyDetails') : fb.copy

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-xl border border-red-500/20 bg-red-500/[0.05] p-6">
        <h2 className="mb-2 text-lg font-semibold text-red-400">{title}</h2>
        <p className="mb-4 text-sm text-zinc-400">{detail}</p>
        <pre className="mb-4 max-h-40 overflow-auto rounded bg-black/40 p-3 text-[11px] text-zinc-500 whitespace-pre-wrap">
          {error.message}
        </pre>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            {reloadLabel}
          </button>
          <button
            onClick={() => void navigator.clipboard.writeText(info)}
            className="rounded-lg border border-white/[0.07] px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {copyLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ErrorBoundary ────────────────────────────────────────────────────────────

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, info: '' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const details = [
      `Time: ${new Date().toISOString()}`,
      `Error: ${error.message}`,
      `Stack: ${error.stack ?? '(no stack)'}`,
      `Component: ${info.componentStack ?? '(unknown)'}`,
    ].join('\n')

    this.setState({ error, info: details })
    void writeErrorLog(details)
  }

  render() {
    if (!this.state.error) return this.props.children

    return <ErrorDisplay error={this.state.error} info={this.state.info} />
  }
}
