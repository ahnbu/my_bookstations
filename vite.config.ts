// vite.config.ts

import { fileURLToPath, URL } from 'url';
import { defineConfig, loadEnv, type ConfigEnv } from 'vite';

export default defineConfig(({ mode }: ConfigEnv) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // [핵심 수정] @가 프로젝트 루트('.')를 가리키도록 수정
          '@': fileURLToPath(new URL('.', import.meta.url))
        }
      },
      server: {
        hmr: {
          overlay: false,
        },
        proxy: {
          '/ttb/api': {
            target: 'http://www.aladin.co.kr',
            changeOrigin: true,
          },
        },
      },
    };
});