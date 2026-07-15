import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    react(),
    // tailwindcss() — УБРАЛИ ЭТУ СТРОКУ!
  ],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    rollupOptions: {
      output: {
        // отдельный vendor-чанк: кэшируется между версиями приложения
        // supabase-js отдельно от vendor: он тяжёлый, нужен только при
        // настроенном .env и обновляется независимо от React-стека
        // sentry тоже отдельно: без своего чанка он попадал бы прямо в
        // index (там нет manualChunks-записи по умолчанию) и раздувал бы
        // ИМЕННО тот чанк, что перевыпускается при каждом изменении кода
        // приложения — а SDK меняется намного реже
        manualChunks: { vendor: ['react', 'react-dom', 'motion', 'lucide-react', 'sonner'], supabase: ['@supabase/supabase-js'], sentry: ['@sentry/react'] },
      },
    },
  },
})