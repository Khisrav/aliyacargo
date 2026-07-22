export function useWorkerGate() {
  const { initData, ready, isTelegram } = useTelegram()
  const { apiFetch } = useApi(initData)

  async function gate(): Promise<'worker' | 'guest'> {
    if (!ready.value) {
      await new Promise<void>((resolve) => {
        const stop = watch(ready, (value) => {
          if (value) {
            stop()
            resolve()
          }
        }, { immediate: true })
      })
    }

    if (!initData.value && !import.meta.dev) {
      return 'guest'
    }

    try {
      await apiFetch('/api/auth/check', { method: 'POST' })
      return 'worker'
    }
    catch {
      return 'guest'
    }
  }

  async function requireWorker() {
    const role = await gate()
    if (role === 'guest') {
      await navigateTo('/track')
      return false
    }
    return true
  }

  return { gate, requireWorker, isTelegram }
}
