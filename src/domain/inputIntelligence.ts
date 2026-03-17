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

  let intensity: InputIntensity
  if (keystrokesPerMin >= KPM_THRESHOLDS.intense) intensity = 'intense'
  else if (keystrokesPerMin >= KPM_THRESHOLDS.active) intensity = 'active'
  else if (keystrokesPerMin >= KPM_THRESHOLDS.moderate) intensity = 'moderate'
  else if (keystrokesPerMin >= KPM_THRESHOLDS.light) intensity = 'light'
  else intensity = 'idle'

  // DWS boost: intense typing = up to +20 points
  const dwsBoost = Math.min(20, Math.round((keystrokesPerMin / KPM_THRESHOLDS.intense) * 20))

  return { intensity, keystrokesPerMin, clicksPerMin, dwsBoost }
}

export function isInputActive(activity: InputActivity, thresholdKpm = KPM_THRESHOLDS.light): boolean {
  const windowMinutes = activity.windowMs / 60_000
  if (windowMinutes === 0) return false
  const kpm = activity.keystrokes / windowMinutes
  return kpm >= thresholdKpm
}
