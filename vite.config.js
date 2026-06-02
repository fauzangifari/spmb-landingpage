import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    define: {
      'import.meta.env.API_MAPBOX': JSON.stringify(env.API_MAPBOX || '')
    }
  };
});
