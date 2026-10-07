import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Im Entwicklungsmodus läuft der Online-Server getrennt (pnpm server, Port 3000).
  server: {
    port: 5173,
    proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } },
  },
});
