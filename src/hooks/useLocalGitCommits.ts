import { useState, useEffect, useRef } from 'react'
import type { GitCommit } from '../domain/codeQuality'

// Extracts the workspace/repo folder name from a VSCode/Cursor window title.
// Title formats:
//   "filename.ts — repo-name — Visual Studio Code"
//   "repo-name — Visual Studio Code"
function extractVSCodeWorkspace(title: string): string | null {
  // Match the last "— something —" segment before the app name
  const m = title.match(/—\s+([^—]+?)\s+—\s+(?:Visual Studio Code|Cursor)\s*$/i)
  return m ? m[1].trim() : null
}

async function invokeGetGitLog(repoPath: string, sinceDate: string): Promise<GitCommit[]> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<GitCommit[]>('get_git_log', { repoPath, sinceDate })
  } catch {
    return []
  }
}

function sevenDaysAgoDate(): string {
  const d = new Date(Date.now() - 7 * 86_400_000)
  return d.toISOString().slice(0, 10)
}

export function useLocalGitCommits(
  recentTitles: string[],
  workspaceRoot: string | null,
): GitCommit[] {
  const [commits, setCommits] = useState<GitCommit[]>([])
  const lastRepoRef = useRef<string | null>(null)

  useEffect(() => {
    if (!workspaceRoot) return

    // Find the first workspace name from recent VSCode/Cursor titles
    let detectedWorkspace: string | null = null
    for (const title of recentTitles) {
      detectedWorkspace = extractVSCodeWorkspace(title)
      if (detectedWorkspace) break
    }
    if (!detectedWorkspace) return

    // Normalize path separator
    const sep = workspaceRoot.includes('\\') ? '\\' : '/'
    const repoPath = `${workspaceRoot}${sep}${detectedWorkspace}`

    if (repoPath === lastRepoRef.current) return
    lastRepoRef.current = repoPath

    void invokeGetGitLog(repoPath, sevenDaysAgoDate()).then(setCommits)
  }, [recentTitles, workspaceRoot])

  return commits
}
