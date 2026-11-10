import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

// Short commit id + build date, shown in the footer so it's easy to tell which version is live.
const sha = (() => {
  if (process.env.WORKERS_CI_COMMIT_SHA) return process.env.WORKERS_CI_COMMIT_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; }
})();
const BUILD = `${sha} · ${new Date().toISOString().slice(0, 10)}`;

export default defineConfig({ plugins: [react()], base: './', define: { __BUILD__: JSON.stringify(BUILD) } });
