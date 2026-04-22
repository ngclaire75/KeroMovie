import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const region = env.VITE_AWS_REGION || 'us-east-1';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/rekognition': {
          target: `https://rekognition.${region}.amazonaws.com`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/rekognition/, ''),
        },
      },
    },
  };
});
