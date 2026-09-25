import tailwindcss from '@tailwindcss/vite';
import reagir from '@vitejs/plugin-react';
import caminho from 'caminho';
import { defineConfig } from 'convite';

export default defineConfig({
  base: '/Vozgerador/',
  plugins: [reagir(), tailwindcss()],
  resolver: {
    pseudonimo: {
      '@': caminho.resolve(__dirname, '.'),
    },
  },
  servidor: {
    // O HMR está desativado no AI Studio...
    hmr: process.env.DESATIVAR_HMR === 'verdadeiro' ? null : {},
    assistir: process.env.DESATIVAR_HMR === 'verdadeiro' ? false : true,
  },
});
