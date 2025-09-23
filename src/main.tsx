
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { MobileAppInitializer } from './components/mobile/MobileAppInitializer'
import { preloadCriticalResources, addResourceHints } from './utils/performanceOptimizer'

// Performance optimizations
preloadCriticalResources();
addResourceHints();

// Register service worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Novo conteúdo disponível. Atualizar?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('Aplicativo pronto para funcionar offline')
  },
})

createRoot(document.getElementById("root")!).render(
  <>
    <MobileAppInitializer />
    <App />
  </>
);
