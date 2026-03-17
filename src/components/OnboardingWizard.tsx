import { useState } from 'react'
import { useI18n } from '../i18n'
import { FOCUS_PRESETS } from '../domain/focusGuard'

type OnCompletePayload = { categories: string[]; preset: string }

type Props = {
  onComplete: (payload: OnCompletePayload) => void
}

const SUGGESTED_CATEGORIES = ['Work', 'Study', 'Exercise', 'Personal']

export function OnboardingWizard({ onComplete }: Props) {
  const { t } = useI18n()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [categories, setCategories] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [preset, setPreset] = useState(FOCUS_PRESETS[0].name)

  function addCategory(name: string) {
    const trimmed = name.trim()
    if (trimmed && !categories.includes(trimmed)) setCategories(c => [...c, trimmed])
  }

  function handleAdd() {
    addCategory(input)
    setInput('')
  }

  function handleFinish() {
    onComplete({ categories, preset })
  }

  if (step === 1) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0f0f] px-6 text-center">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-600">Time Tracker</p>
        <h1 className="mb-4 text-2xl font-semibold text-zinc-100 max-w-sm leading-snug">
          {t('onboarding.step1Title')}
        </h1>
        <p className="mb-10 text-sm text-zinc-500 max-w-xs">{t('onboarding.step1Sub')}</p>
        <button
          onClick={() => setStep(2)}
          className="rounded-lg border border-white/[0.1] bg-white/[0.06] px-8 py-3 text-sm font-medium text-zinc-100 hover:bg-white/[0.1] transition-all"
        >
          {t('onboarding.start')}
        </button>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0f0f] px-6">
        <div className="w-full max-w-sm">
          <h2 className="mb-1 text-xl font-semibold text-zinc-100">{t('onboarding.step2Title')}</h2>
          <p className="mb-6 text-sm text-zinc-500">{t('onboarding.step2Sub')}</p>

          {/* Suggestions */}
          <div className="mb-4 flex flex-wrap gap-2">
            {SUGGESTED_CATEGORIES.map(name => (
              <button
                key={name}
                onClick={() => addCategory(name)}
                className={`rounded-full border px-3 py-1 text-xs transition-all ${
                  categories.includes(name)
                    ? 'border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-400'
                    : 'border-white/[0.08] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="mb-4 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-white/[0.07] bg-white/3 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/15 transition-all"
              placeholder={t('onboarding.addPlaceholder')}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className="rounded-lg border border-white/[0.07] bg-white/3 px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 transition-all"
            >
              {t('onboarding.add')}
            </button>
          </div>

          {/* Added list */}
          {categories.length > 0 && (
            <ul className="mb-6 space-y-1">
              {categories.map(name => (
                <li key={name} className="flex items-center justify-between rounded-md border border-white/[0.06] px-3 py-2 text-sm text-zinc-300">
                  <span>{name}</span>
                  <button
                    onClick={() => setCategories(c => c.filter(n => n !== name))}
                    className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => setStep(3)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] py-2.5 text-sm text-zinc-300 hover:text-zinc-100 hover:border-white/15 transition-all"
          >
            {t('onboarding.continue')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0f0f] px-6">
      <div className="w-full max-w-sm">
        <h2 className="mb-1 text-xl font-semibold text-zinc-100">{t('onboarding.step3Title')}</h2>
        <p className="mb-6 text-sm text-zinc-500">{t('onboarding.step3Sub')}</p>

        <div className="mb-8 space-y-2">
          {FOCUS_PRESETS.map(p => (
            <button
              key={p.name}
              onClick={() => setPreset(p.name)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-all ${
                preset === p.name
                  ? 'border-emerald-500/40 bg-emerald-500/[0.06] text-emerald-300'
                  : 'border-white/[0.07] text-zinc-400 hover:border-white/15 hover:text-zinc-200'
              }`}
            >
              <span className="font-medium text-sm">{p.name}</span>
              <span className="ml-2 text-xs opacity-60">
                {Math.round(p.workMs / 60000)} min / {Math.round(p.breakMs / 60000)} min
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={handleFinish}
          className="w-full rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/[0.14] transition-all"
        >
          {t('onboarding.done')}
        </button>
      </div>
    </div>
  )
}
