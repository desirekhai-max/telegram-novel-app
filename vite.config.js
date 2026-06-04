import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { novelOgPreviewPlugin } from './vite-plugin-novel-og.js'

function gitShortHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_COMMIT__: JSON.stringify(gitShortHash()),
  },
  plugins: [react(), novelOgPreviewPlugin()],
  server: {
    // 监听 IPv4+IPv6，避免 cloudflared 连 127.0.0.1 时连不上（仅 ::1 时）
    host: true,
    // 允许 Cloudflare 穿透访问，解决 Blocked request 报错
    allowedHosts: true,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  }
})