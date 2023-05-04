import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { createI18n } from 'vue-i18n'
import { languages, defaultLocale } from './language'

import { getOBPResourceDocs, getGroupedResourceDocs } from './obp/resource-docs'

import 'element-plus/dist/index.css'
import './assets/main.css'
;(async () => {
  const app = createApp(App)

  const cache = await caches.open('obp-resource-docs-cache')
  const response = await cache.match('/tags')
  let docs
  if (response) {
    docs = await response.json()
  } else {
    docs = await getOBPResourceDocs()
    await cache.put('/tags', new Response(JSON.stringify(docs)))
  }
  const groupedDocs = await getGroupedResourceDocs(docs)
  app.provide('OBP-ResourceDocs', docs)
  app.provide('OBP-GroupedResourceDocs', groupedDocs)
  app.provide('OBP-API-Host', import.meta.env.VITE_OBP_API_HOST)

  const messages = Object.assign(languages)
  const i18n = createI18n({
    locale: defaultLocale,
    fallbackLocale: 'ES',
    messages
  })
  app.provide('i18n', i18n)

  app.use(i18n)
  app.use(createPinia())
  app.use(router)

  app.mount('#app')
})()
