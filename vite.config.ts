import { fileURLToPath, URL } from 'url';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('.', import.meta.url)),
        }
      },
      server: {
        proxy: {
          // '/ttb/api'로 시작하는 요청을 위한 프록시 규칙
          '/ttb/api': {
            // 실제 API 서버 주소
            target: 'http://www.aladin.co.kr',
            // CORS 문제를 피하기 위해 origin을 변경
            changeOrigin: true,
          },
        },
      },
    };
});
