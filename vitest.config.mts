import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// src 側と同じ `@/` の別名をテストでも使えるようにする（tsconfig.json の paths と同じ）
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
