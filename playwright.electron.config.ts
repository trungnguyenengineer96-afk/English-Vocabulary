import { defineConfig } from '@playwright/test';

// Desktop-shell tests. Run after `vite build`; on Linux CI wrap with `xvfb-run -a`.
export default defineConfig({ testDir: './e2e-electron', timeout: 60_000, retries: 0 });
