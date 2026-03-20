/**
 * Productivity Challenge — Time Tracker Browser Extension
 * Background Service Worker (Manifest V3)
 *
 * Reports the active tab URL and title to the local Tauri app via HTTP POST
 * to http://localhost:27183/browser whenever the user switches tabs or
 * navigates to a new page.
 *
 * The Tauri app must be running for the data to be received. If it is not
 * running, the fetch fails silently — no user impact.
 */

const ENDPOINT = 'http://localhost:27183/browser'

/** Minimum ms between reports — prevents flooding on rapid tab switches. */
const DEBOUNCE_MS = 1_000

let debounceTimer = null
let lastReportedUrl = null

/**
 * Posts the active tab context to the Tauri app.
 * Ignores browser-internal URLs (chrome://, about:, etc.).
 */
function reportTab(tab) {
  if (!tab?.url) return
  if (
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('chrome-extension://') ||
    tab.url.startsWith('about:') ||
    tab.url.startsWith('moz-extension://') ||
    tab.url.startsWith('edge://')
  ) return

  // Deduplicate: don't re-report the same URL
  if (tab.url === lastReportedUrl) return

  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    lastReportedUrl = tab.url
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: tab.url, title: tab.title ?? '' }),
    }).catch(() => {
      // Tauri app not running — ignore silently
    })
  }, DEBOUNCE_MS)
}

/** Fired when the user switches to a different tab. */
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError) return
    reportTab(tab)
  })
})

/** Fired when a tab finishes loading or its URL changes. */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return
  // Only report the active tab
  if (!tab.active) return
  reportTab(tab)
})

/** On extension startup, report the current active tab immediately. */
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab) reportTab(tab)
})
