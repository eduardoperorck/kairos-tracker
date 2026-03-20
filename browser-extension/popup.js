const dot = document.getElementById('dot')
const statusText = document.getElementById('statusText')
const currentUrl = document.getElementById('currentUrl')

// Check if the Tauri app is reachable
fetch('http://localhost:27183/browser', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'ping', title: 'ping' }),
})
  .then(() => {
    dot.className = 'dot connected'
    statusText.textContent = 'Tracker connected'
  })
  .catch(() => {
    dot.className = 'dot disconnected'
    statusText.textContent = 'Tracker not running'
  })

// Show the current active tab URL
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab?.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:')) {
    currentUrl.textContent = tab.url
  }
})
