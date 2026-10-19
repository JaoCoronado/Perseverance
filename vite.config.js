import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      // NASA's MMGIS files have no CORS headers, so the browser reaches them through the dev server.
      '/nasa': {
        target: 'https://mars.nasa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nasa/, ''),
      },
    },
  },
});
