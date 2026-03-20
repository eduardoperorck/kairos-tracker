import * as vscode from 'vscode'
import { spawnSync } from 'child_process'

let statusBar: vscode.StatusBarItem
let pollInterval: NodeJS.Timeout | undefined
let contextDebounce: NodeJS.Timeout | undefined

const TRACKER_ENDPOINT = 'http://localhost:27183/editor'

// Run CLI with a fixed argument array — never via a shell string to prevent injection.
function runCli(args: string[]): string {
  const config = vscode.workspace.getConfiguration('timeTracker')
  const timeoutMs: number = config.get('cliTimeoutMs') ?? 2000
  const result = spawnSync('npx', ['@productivity-challenge/cli', ...args], {
    encoding: 'utf8',
    timeout: timeoutMs,
    shell: false,
  })
  return (result.stdout ?? '').trim()
}

function getStatus(): string | null {
  try {
    const output = runCli(['status'])
    if (!output || output.includes('No active timer')) return null

    // Parse "▶ Active: Work · 01:23:45 elapsed"
    const match = output.match(/Active:\s+(.+?)\s+·\s+(.+?)\s+elapsed/)
    if (match) return `⏱ ${match[1]} · ${match[2]}`

    return null
  } catch {
    return null
  }
}

function updateStatusBar() {
  const status = getStatus()
  if (status) {
    statusBar.text = status
    statusBar.tooltip = 'Time Tracker — click to stop'
    statusBar.command = 'timeTracker.stop'
    statusBar.show()
  } else {
    statusBar.text = '⏱ Time Tracker'
    statusBar.tooltip = 'Time Tracker — no active timer'
    statusBar.command = 'timeTracker.start'
    statusBar.show()
  }
}

/**
 * M-C2: Reports the current workspace and open file to the Tauri tracker.
 * Debounced to 500 ms to avoid flooding on rapid file switches.
 */
function reportEditorContext() {
  clearTimeout(contextDebounce)
  contextDebounce = setTimeout(() => {
    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name ?? ''
    const editor = vscode.window.activeTextEditor
    const filePath = editor?.document?.fileName ?? ''
    const language = editor?.document?.languageId ?? ''

    if (!workspaceName) return

    // Extract just the filename, not the full path, to avoid leaking personal paths
    const fileName = filePath.split(/[\\/]/).pop() ?? ''

    const body = JSON.stringify({
      workspace: workspaceName,
      file: fileName,
      language,
    })

    // Use Node.js http module — no external dependencies, works in VS Code extension host
    try {
      const http = require('http') as typeof import('http')
      const req = http.request(
        { hostname: '127.0.0.1', port: 27183, path: '/editor', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        () => {} // ignore response
      )
      req.on('error', () => {}) // tracker not running — ignore silently
      req.write(body)
      req.end()
    } catch {
      // http module unavailable — ignore
    }
  }, 500)
}

export function activate(context: vscode.ExtensionContext) {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  context.subscriptions.push(statusBar)

  context.subscriptions.push(
    vscode.commands.registerCommand('timeTracker.start', async () => {
      const cats = await vscode.window.showQuickPick(
        getCategoryNames(),
        { placeHolder: 'Select a category to start' }
      )
      if (!cats) return
      try {
        runCli(['start', cats])
        updateStatusBar()
        vscode.window.setStatusBarMessage(`⏱ Started: ${cats}`, 3000)
      } catch (e) {
        vscode.window.showErrorMessage(`Time Tracker: failed to start timer`)
      }
    }),

    vscode.commands.registerCommand('timeTracker.stop', () => {
      try {
        runCli(['stop'])
        updateStatusBar()
        vscode.window.setStatusBarMessage('⏹ Timer stopped', 3000)
      } catch (e) {
        vscode.window.showErrorMessage(`Time Tracker: failed to stop timer`)
      }
    }),

    vscode.commands.registerCommand('timeTracker.status', () => {
      const status = getStatus()
      vscode.window.showInformationMessage(status ?? 'No active timer')
    }),
  )

  // M-C2: Report editor context on file changes and workspace changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => reportEditorContext()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => reportEditorContext()),
  )

  // Poll every 30 seconds
  updateStatusBar()
  pollInterval = setInterval(updateStatusBar, 30_000)
  context.subscriptions.push({ dispose: () => clearInterval(pollInterval) })

  // Report initial context
  reportEditorContext()
}

function getCategoryNames(): string[] {
  try {
    const out = runCli(['today'])
    const lines = out.split('\n').filter(l => l.trim().startsWith('  ') && !l.includes('Total') && !l.includes('─'))
    return lines.map(l => l.trim().split(/\s+/)[0]).filter(Boolean)
  } catch {
    return ['Work', 'Study', 'Exercise']
  }
}

export function deactivate() {
  clearInterval(pollInterval)
  clearTimeout(contextDebounce)
}
