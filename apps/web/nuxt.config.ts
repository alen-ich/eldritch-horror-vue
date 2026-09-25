// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  routeRules: {
    '/cards/data/index.json': { headers: { 'cache-control': 'public, max-age=300' } },
    '/cards/data/details/**': { headers: { 'cache-control': 'public, max-age=3600' } },
    '/cards/thumbnails/**': { headers: { 'cache-control': 'public, max-age=86400' } },
    '/cards/front/**': { headers: { 'cache-control': 'public, max-age=86400' } },
    '/cards/back/**': { headers: { 'cache-control': 'public, max-age=86400' } },
    '/map/**': { headers: { 'cache-control': 'public, max-age=86400' } }
  },
  runtimeConfig: {
    public: {
      colyseusUrl: process.env.NUXT_PUBLIC_COLYSEUS_URL || 'http://localhost:2567'
    }
  }
})
