async function sendNotification(title: string, body: string): Promise<void> {
  try {
    const { sendNotification } = await import(/* @vite-ignore */ '@tauri-apps/plugin-notification')
    await sendNotification({ title, body })
  } catch {
    // fallback: browser Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  }
}

export function useNotifications() {
  async function notifyGoalReached(categoryName: string, goalHours: number) {
    await sendNotification(
      'Goal reached!',
      `You've reached your ${goalHours}h goal for ${categoryName} this week.`
    )
  }

  async function notifyDailyReminder(hour: number) {
    await sendNotification(
      'Daily reminder',
      `It's ${hour}:00 — time to start tracking!`
    )
  }

  async function notifyLongSession(categoryName: string, hours: number) {
    await sendNotification(
      'Long session detected',
      `You've been tracking ${categoryName} for ${hours}h. Consider taking a break.`
    )
  }

  return { notifyGoalReached, notifyDailyReminder, notifyLongSession }
}
