/** Shared Tailwind class strings for the three button variants used throughout the app. */

/** Subtle bordered button — secondary actions (save, add, toggle) */
export const btnOutlined =
  'rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all'

/** Ghost button — low-priority actions (cancel, skip, links) */
export const btnGhost =
  'text-xs text-zinc-500 hover:text-zinc-200 transition-colors'

/** Filled/tinted button — primary or start action */
export const btnPrimary =
  'rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:border-white/[0.16] hover:bg-white/[0.08] transition-all'
