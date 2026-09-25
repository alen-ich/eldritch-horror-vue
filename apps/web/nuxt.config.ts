// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  runtimeConfig: {
    public: {
      colyseusUrl: process.env.NUXT_PUBLIC_COLYSEUS_URL || 'http://localhost:2567'
    }
  }
})
