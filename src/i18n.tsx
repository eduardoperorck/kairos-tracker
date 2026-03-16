import { createContext, useContext, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'pt'

const en = {
  'app.title': 'Time Tracker',
  'nav.timer': 'Timer',
  'nav.stats': 'Stats',
  'nav.history': 'History',
  'nav.today': 'Today',
  'nav.settings': 'Settings',
  'tracker.placeholder': 'Category name',
  'tracker.add': 'Add',
  'tracker.empty': 'Add a category to start tracking time.',
  'tracker.focusLock': 'Enter Focus Lock',
  'category.start': 'Start',
  'category.stop': 'Stop',
  'category.delete': 'Delete',
  'category.confirm': 'Confirm',
  'category.cancel': 'Cancel',
  'category.addTag': '+ tag',
  'category.clearTag': 'clear tag',
  'category.lastTracked': 'last tracked',
  'category.colorLabel': 'Category color',
  'stats.title': 'Statistics',
  'stats.back': '← Back',
  'stats.today': 'Today',
  'stats.thisWeek': 'This week',
  'stats.patterns': 'Patterns',
  'stats.empty': 'No data yet.',
  'stats.streak': 'd streak',
  'stats.flow': 'flow',
  'stats.prevWeek': '← prev',
  'stats.nextWeek': 'next →',
  'stats.weekOf': 'week of',
  'stats.hourDist': 'Hour Distribution',
  'stats.heatmap': 'Activity Heatmap (13 weeks)',
  'history.title': 'History',
  'history.empty': 'No history yet.',
  'history.importToggl': 'Import Toggl',
  'intentions.title': "Today's Intentions",
  'intentions.placeholder': 'What do you intend to accomplish today?',
  'intentions.add': 'Add',
  'intentions.empty': 'No intentions set yet.',
  'intentions.markDone': 'Mark done',
  'intentions.markUndone': 'Mark undone',
  'intentions.eveningTitle': 'Evening Review',
  'intentions.howWasDay': 'How was your day?',
  'intentions.notesPlaceholder': 'Notes about your day...',
  'intentions.saveReview': 'Save Review',
  'intentions.lastSaved': 'Last saved: mood',
  'focusGuard.breakTime': 'Break time',
  'focusGuard.focused': 'You focused for',
  'focusGuard.earned': 'min — you earned this.',
  'focusGuard.strict': 'Strict mode — no skipping',
  'focusGuard.skipPostpone': 'Skip / Postpone',
  'focusGuard.skipBreak': 'Skip break',
  'focusGuard.postpone5': 'Postpone 5 min',
  'focusGuard.skipAnyway': 'Skip anyway',
  'focusGuard.typeSkip': 'Type',
  'focusGuard.toConfirm': 'to confirm',
  'focusGuard.confirmSkip': 'Confirm skip',
  'settings.title': 'Settings',
  'settings.backup': 'Backup & Restore',
  'settings.downloadBackup': 'Download Backup (JSON)',
  'settings.restoreBackup': 'Restore from Backup',
  'settings.focusPreset': 'Focus Guard Preset',
  'settings.strictMode': 'Strict mode',
  'settings.strictOn': 'no skipping allowed',
  'settings.strictOff': 'skipping allowed',
  'settings.apiKey': 'Claude API Key',
  'settings.apiKeyDesc': 'Used for AI Weekly Digest. Stored locally, never sent anywhere else.',
  'settings.sync': 'OneDrive / Folder Sync',
  'settings.syncDesc': 'Export a JSON snapshot to a folder (e.g. OneDrive) for multi-device sync.',
  'settings.syncSave': 'Save',
  'settings.syncNow': 'Sync Now',
  'settings.webhooks': 'Webhooks',
  'settings.webhooksDesc': 'POST to this URL on timer start/stop events.',
  'settings.save': 'Save',
  'settings.saved': 'Saved ✓',
  'settings.language': 'Language',
} as const

const pt: typeof en = {
  'app.title': 'Time Tracker',
  'nav.timer': 'Tempo',
  'nav.stats': 'Dados',
  'nav.history': 'Histórico',
  'nav.today': 'Hoje',
  'nav.settings': 'Config.',
  'tracker.placeholder': 'Nome da categoria',
  'tracker.add': 'Adicionar',
  'tracker.empty': 'Adicione uma categoria para começar a registrar tempo.',
  'tracker.focusLock': 'Entrar em Focus Lock',
  'category.start': 'Iniciar',
  'category.stop': 'Parar',
  'category.delete': 'Excluir',
  'category.confirm': 'Confirmar',
  'category.cancel': 'Cancelar',
  'category.addTag': '+ tag',
  'category.clearTag': 'limpar tag',
  'category.lastTracked': 'última vez',
  'category.colorLabel': 'Cor da categoria',
  'stats.title': 'Estatísticas',
  'stats.back': '← Voltar',
  'stats.today': 'Hoje',
  'stats.thisWeek': 'Esta semana',
  'stats.patterns': 'Padrões',
  'stats.empty': 'Sem dados ainda.',
  'stats.streak': 'd seguidos',
  'stats.flow': 'flow',
  'stats.prevWeek': '← ant',
  'stats.nextWeek': 'próx →',
  'stats.weekOf': 'semana de',
  'stats.hourDist': 'Distribuição por Hora',
  'stats.heatmap': 'Heatmap de Atividade (13 semanas)',
  'history.title': 'Histórico',
  'history.empty': 'Sem histórico ainda.',
  'history.importToggl': 'Importar Toggl',
  'intentions.title': 'Intenções do Dia',
  'intentions.placeholder': 'O que você pretende realizar hoje?',
  'intentions.add': 'Adicionar',
  'intentions.empty': 'Nenhuma intenção definida ainda.',
  'intentions.markDone': 'Marcar como feito',
  'intentions.markUndone': 'Marcar como não feito',
  'intentions.eveningTitle': 'Revisão da Tarde',
  'intentions.howWasDay': 'Como foi seu dia?',
  'intentions.notesPlaceholder': 'Notas sobre seu dia...',
  'intentions.saveReview': 'Salvar Revisão',
  'intentions.lastSaved': 'Último salvo: humor',
  'focusGuard.breakTime': 'Hora de pausar',
  'focusGuard.focused': 'Você focou por',
  'focusGuard.earned': 'min — você merece isso.',
  'focusGuard.strict': 'Modo estrito — sem pular',
  'focusGuard.skipPostpone': 'Pular / Adiar',
  'focusGuard.skipBreak': 'Pular pausa',
  'focusGuard.postpone5': 'Adiar 5 min',
  'focusGuard.skipAnyway': 'Pular mesmo assim',
  'focusGuard.typeSkip': 'Digite',
  'focusGuard.toConfirm': 'para confirmar',
  'focusGuard.confirmSkip': 'Confirmar pulo',
  'settings.title': 'Configurações',
  'settings.backup': 'Backup & Restauração',
  'settings.downloadBackup': 'Baixar Backup (JSON)',
  'settings.restoreBackup': 'Restaurar Backup',
  'settings.focusPreset': 'Preset do Focus Guard',
  'settings.strictMode': 'Modo estrito',
  'settings.strictOn': 'sem permissão de pular',
  'settings.strictOff': 'pode pular',
  'settings.apiKey': 'Chave API Claude',
  'settings.apiKeyDesc': 'Usada para o Resumo Semanal IA. Armazenada localmente, nunca enviada para outro lugar.',
  'settings.sync': 'Sync OneDrive / Pasta',
  'settings.syncDesc': 'Exporta um snapshot JSON para uma pasta (ex: OneDrive) para sincronização multi-dispositivo.',
  'settings.syncSave': 'Salvar',
  'settings.syncNow': 'Sincronizar Agora',
  'settings.webhooks': 'Webhooks',
  'settings.webhooksDesc': 'POST para esta URL em eventos de start/stop do timer.',
  'settings.save': 'Salvar',
  'settings.saved': 'Salvo ✓',
  'settings.language': 'Idioma',
}

const translations: Record<Lang, typeof en> = { en, pt }

export type TKey = keyof typeof en

export const DAY_LABELS: Record<Lang, string[]> = {
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  pt: ['Se', 'Te', 'Qu', 'Qu', 'Se', 'Sá', 'Do'],
}

type I18nContextType = {
  t: (key: TKey) => string
  lang: Lang
  setLang: (lang: Lang) => void
}

const I18nContext = createContext<I18nContextType>({
  t: key => key,
  lang: 'en',
  setLang: () => {},
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    localStorage.getItem('lang') === 'pt' ? 'pt' : 'en'
  )

  function setLang(next: Lang) {
    setLangState(next)
    localStorage.setItem('lang', next)
  }

  const t = (key: TKey): string => translations[lang][key]

  return <I18nContext.Provider value={{ t, lang, setLang }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
