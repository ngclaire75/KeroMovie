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
        '/api/chat': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res) => {
              if (!res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
              }
              res.end(JSON.stringify({ error: 'Local backend offline. Run: cd backend && go run main.go' }));
            });
          },
        },
      },
    },
  };
});
