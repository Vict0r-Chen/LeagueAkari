import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Composable to prevent device screen from dimming or locking (Screen Wake Lock API).
 * Useful for mobile / PWA secondary screen dashboard.
 */
export function useWakeLock() {
  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const isLocked = ref(false)
  let wakeLockSentinel: any = null

  const request = async () => {
    if (!isSupported) {
      return false
    }

    try {
      if (document.visibilityState !== 'visible') {
        return false
      }

      wakeLockSentinel = await (navigator as any).wakeLock.request('screen')
      isLocked.value = true

      wakeLockSentinel.addEventListener('release', () => {
        isLocked.value = false
        wakeLockSentinel = null
      })

      return true
    } catch {
      isLocked.value = false
      wakeLockSentinel = null
      return false
    }
  }

  const release = async () => {
    if (wakeLockSentinel) {
      try {
        await wakeLockSentinel.release()
      } catch {
        // ignore error
      }
      wakeLockSentinel = null
      isLocked.value = false
    }
  }

  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      await request()
    } else {
      isLocked.value = false
      wakeLockSentinel = null
    }
  }

  onMounted(() => {
    // Try requesting wake lock immediately
    request()

    // Mobile browsers often require user gesture/interaction to allow wake lock
    const handleFirstInteraction = async () => {
      if (!isLocked.value) {
        await request()
      }
    }

    window.addEventListener('touchstart', handleFirstInteraction, { passive: true })
    window.addEventListener('click', handleFirstInteraction, { passive: true })

    // Re-acquire wake lock when returning to app from background
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    release()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return {
    isSupported,
    isLocked,
    request,
    release
  }
}
