import type { Session, Category } from '../domain/timer'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

function notionHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  }
}

function buildPageProperties(session: Session, categoryName: string) {
  const durationMin = Math.round((session.endedAt - session.startedAt) / 60_000)
  const startTime = new Date(session.startedAt).toISOString()
  const endTime = new Date(session.endedAt).toISOString()

  return {
    Name: {
      title: [{ text: { content: `${categoryName} — ${session.date}` } }],
    },
    Date: {
      date: { start: session.date },
    },
    Category: {
      select: { name: categoryName },
    },
    Duration: {
      number: durationMin,
    },
    Start: {
      rich_text: [{ text: { content: startTime } }],
    },
    End: {
      rich_text: [{ text: { content: endTime } }],
    },
    ...(session.tag ? { Tag: { rich_text: [{ text: { content: session.tag } }] } } : {}),
  }
}

export async function exportSessionsToNotion(
  sessions: Session[],
  categories: Category[],
  token: string,
  databaseId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ exported: number; errors: number }> {
  const catMap = new Map(categories.map(c => [c.id, c.name]))
  let exported = 0
  let errors = 0

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i]
    const categoryName = catMap.get(session.categoryId) ?? 'Unknown'
    try {
      const res = await fetch(`${NOTION_API}/pages`, {
        method: 'POST',
        headers: notionHeaders(token),
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: buildPageProperties(session, categoryName),
        }),
      })
      if (!res.ok) {
        errors++
      } else {
        exported++
      }
    } catch {
      errors++
    }
    onProgress?.(i + 1, sessions.length)
  }

  return { exported, errors }
}
