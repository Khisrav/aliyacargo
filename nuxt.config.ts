// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],

  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/i18n'],

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: 'tailwind.config.ts',
  },

  app: {
    head: {
      title: 'Aliya Cargo',
      script: [{ src: 'https://telegram.org/js/telegram-web-app.js' }],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'theme-color', content: '#0F766E' },
      ],
    },
  },

  vite: {
    server: {
      // Allow ngrok (and similar) tunnel hosts in local dev
      allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
    },
  },

  runtimeConfig: {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    allowedNicknames: process.env.ALLOWED_NICKNAMES || '',
    supabaseUrl: process.env.SUPABASE_URL || process.env.NUXT_SUPABASE_URL || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || process.env.NUXT_SUPABASE_SERVICE_KEY || '',
    pricePerKg: Number(process.env.PRICE_PER_KG) || 30,
    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL || '',
    },
  },

  i18n: {
    defaultLocale: 'ru',
    strategy: 'no_prefix',
    locales: [
      { code: 'ru', name: 'Русский', language: 'ru-RU', file: 'ru.json' },
      { code: 'tg', name: 'Тоҷикӣ', language: 'tg-TJ', file: 'tg.json' },
      { code: 'uz', name: 'Oʻzbekcha', language: 'uz-UZ', file: 'uz.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'aliya_locale',
      fallbackLocale: 'ru',
      redirectOn: 'root',
    },
  },
})
