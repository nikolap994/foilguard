// Content script — runs in every page's isolated world.
// Blocks drive-by popups: window.open() calls that happen without
// a genuine user click within the last 800ms.

(function () {
  let enabled = true

  // Fetch the current policy setting once on inject.
  // Default stays true until the response arrives.
  chrome.runtime.sendMessage({ type: 'get-policy' }, (p: { blockPopups?: boolean } | undefined) => {
    if (p && typeof p.blockPopups === 'boolean') enabled = p.blockPopups
  })

  let lastClickMs = 0

  // Capture-phase listeners fire before any site script can call stopPropagation.
  document.addEventListener('click',      () => { lastClickMs = Date.now() }, { capture: true, passive: true })
  document.addEventListener('touchend',   () => { lastClickMs = Date.now() }, { capture: true, passive: true })
  document.addEventListener('contextmenu',() => { lastClickMs = Date.now() }, { capture: true, passive: true })

  const nativeOpen = window.open.bind(window)

  window.open = function (url?: string | URL, target?: string, features?: string): WindowProxy | null {
    if (!enabled) return nativeOpen(url, target, features)

    // Allow if this window.open() call is a direct response to a user click.
    // 800ms is generous enough for most click handlers but catches timers and
    // scroll/hover-triggered ads.
    if (Date.now() - lastClickMs <= 800) return nativeOpen(url, target, features)

    const href = url ? String(url) : ''
    chrome.runtime.sendMessage({ type: 'popup_suppressed', url: href, pageUrl: location.href })
    return null
  }
})()
