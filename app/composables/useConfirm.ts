export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve: ((value: boolean) => void) | null
}

const state = reactive<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Подтвердить',
  cancelLabel: 'Отмена',
  danger: false,
  resolve: null,
})

export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    if (state.resolve) {
      state.resolve(false)
    }

    state.title = options.title
    state.message = options.message ?? ''
    state.confirmLabel = options.confirmLabel ?? 'Подтвердить'
    state.cancelLabel = options.cancelLabel ?? 'Отмена'
    state.danger = options.danger ?? false
    state.open = true

    return new Promise((resolve) => {
      state.resolve = resolve
    })
  }

  function respond(value: boolean) {
    state.open = false
    state.resolve?.(value)
    state.resolve = null
  }

  return {
    state,
    confirm,
    respond,
  }
}
