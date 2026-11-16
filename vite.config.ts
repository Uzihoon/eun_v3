import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'emulator') throw new Error('Local authentication cannot be included in a production build.');
  return {
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  };
});
