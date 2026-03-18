// Input Intelligence: keyboard + mouse activity as a DWS signal.
// Raw data is collected by the Rust `get_input_activity` command.

export type InputActivity = {
  keystrokes: number
  mouseClicks: number
  mouseDistancePx: number
  windowMs: number // measurement window in ms
}

export type InputIntensity = 'idle' | 'light' | 'moderate' | 'active' | 'intense'

export type InputSignal = {
  intensity: InputIntensity
  keystrokesPerMin: number
  clicksPerMin: number
  mouseDistancePxPerMin: number
  dwsBoost: number // 0–20 bonus points to add to DWS calculation
}

const KPM_THRESHOLDS = {
  idle: 0,
  light: 5,
  moderate: 20,
  active: 50,
  intense: 100,
}

export function analyzeInputActivity(activity: InputActivity): InputSignal {
  const windowMinutes = activity.windowMs / 60_000
  const keystrokesPerMin = windowMinutes > 0 ? activity.keystrokes / windowMinutes : 0
  const clicksPerMin = windowMinutes > 0 ? activity.mouseClicks / windowMinutes : 0
  const mouseDistancePxPerMin = windowMinutes > 0 ? activity.mouseDistancePx / windowMinutes : 0

  // Blend keyboard + mouse only when mouse data is present
  const hasMouse = activity.mouseClicks > 0 || activity.mouseDistancePx > 0
  const mouseActivityScore = hasMouse
    ? Math.min(1, (clicksPerMin / 10 + mouseDistancePxPerMin / 5000) / 2)
    : 0
  const kpmScore = keystrokesPerMin / KPM_THRESHOLDS.intense
  const combinedScore = hasMouse
    ? kpmScore * 0.7 + mouseActivityScore * 0.3
    : kpmScore
  const effectiveKpm = combinedScore * KPM_THRESHOLDS.intense

  let intensity: InputIntensity
  if (effectiveKpm >= KPM_THRESHOLDS.intense) intensity = 'intense'
  else if (effectiveKpm >= KPM_THRESHOLDS.active) intensity = 'active'
  else if (effectiveKpm >= KPM_THRESHOLDS.moderate) intensity = 'moderate'
  else if (effectiveKpm >= KPM_THRESHOLDS.light) intensity = 'light'
  else intensity = 'idle'

  // DWS boost: intense input = up to +20 points
  const dwsBoost = Math.min(20, Math.round(combinedScore * 20))

  return { intensity, keystrokesPerMin, clicksPerMin, mouseDistancePxPerMin, dwsBoost }
}

export function isInputActive(activity: InputActivity, thresholdKpm = KPM_THRESHOLDS.light): boolean {
  const windowMinutes = activity.windowMs / 60_000
  if (windowMinutes === 0) return false
  const kpm = activity.keystrokes / windowMinutes
  return kpm >= thresholdKpm
}
