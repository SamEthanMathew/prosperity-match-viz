import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('plotly')) return 'plotly';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/zustand')) return 'vendor';
        },
      },
    },
  },
});
