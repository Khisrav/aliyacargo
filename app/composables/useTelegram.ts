export function useTelegram() {
  // shallowRef avoids Vue deep-wrapping Telegram's WebApp object in a reactive
  // Proxy, which breaks on its non-configurable properties (e.g. HapticFeedback)
  const webApp = shallowRef<TelegramWebApp | null>(null)
  const initData = ref('')
  const ready = ref(false)
  const isTelegram = ref(false)

  onMounted(() => {
    const tg = window.Telegram?.WebApp
    if (!tg) {
      ready.value = true
      return
    }

    isTelegram.value = true
    webApp.value = tg
    initData.value = tg.initData

    tg.ready()
    tg.expand()
    tg.enableClosingConfirmation()
    ready.value = true
  })

  function haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' = 'light') {
    webApp.value?.HapticFeedback?.impactOccurred(type === 'success' || type === 'error' || type === 'warning' ? 'medium' : type)
    if (type === 'success') webApp.value?.HapticFeedback?.notificationOccurred('success')
    if (type === 'error') webApp.value?.HapticFeedback?.notificationOccurred('error')
  }

  return { webApp, initData, ready, isTelegram, haptic }
}

export function useApi(initData: Ref<string>) {
  async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': initData.value,
        ...options.headers,
      },
    })

    const text = await res.text()

    if (!res.ok) {
      let message = res.statusText || 'Request failed'
      if (text) {
        try {
          const err = JSON.parse(text)
          message = err.statusMessage || err.message || message
        }
        catch { /* keep statusText */ }
      }
      throw new Error(message)
    }

    // Nitro/h3 returns an empty body for `return null`
    if (!text.trim()) return null as T

    try {
      return JSON.parse(text) as T
    }
    catch {
      throw new Error('Некорректный ответ сервера')
    }
  }

  return { apiFetch }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }

  interface TelegramWebApp {
    initData: string
    initDataUnsafe: Record<string, unknown>
    ready: () => void
    expand: () => void
    enableClosingConfirmation: () => void
    close: () => void
    MainButton: {
      text: string
      color: string
      textColor: string
      isVisible: boolean
      isActive: boolean
      show: () => void
      hide: () => void
      enable: () => void
      disable: () => void
      onClick: (cb: () => void) => void
      offClick: (cb: () => void) => void
      setText: (text: string) => void
    }
    HapticFeedback?: {
      impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
      notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    }
    themeParams: Record<string, string>
  }
}
