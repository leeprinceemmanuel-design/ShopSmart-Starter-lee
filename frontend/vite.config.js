// File: frontend/vite.config.js
// Added because the starter was missing it. Without the React plugin,
// the page stays blank with "React is not defined".
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // The React plugin turns JSX into code the browser can run
  plugins: [react()],
  server: {
    port: 5173 // the port the README and backend expect
  }
});
