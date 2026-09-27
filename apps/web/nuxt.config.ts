// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  routeRules: {
    '/cards/mythos/**': { headers: { 'cache-control': 'public, max-age=86400' } },
    '/cards/mysteries/**': { headers: { 'cache-control': 'public, max-age=86400' } },
    '/cards/reference/**': { headers: { 'cache-control': 'public, max-age=86400' } },
    '/tokens/gates/**': { headers: { 'cache-control': 'public, max-age=86400' } },
    '/map/**': { headers: { 'cache-control': 'public, max-age=86400' } }
  },
  runtimeConfig: {
    public: {
      colyseusUrl: process.env.NUXT_PUBLIC_COLYSEUS_URL || 'http://localhost:2567'
    }
  }
})
