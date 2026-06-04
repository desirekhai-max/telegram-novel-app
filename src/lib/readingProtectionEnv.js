/**
 * 阅读页内容保护：仅生产环境启用（防复制/水印等）。
 * Web/Telegram Mini App 无法使用 Android FLAG_SECURE 禁止系统截图/录屏；
 * 开发环境关闭 JS/CSS 层保护，便于调试与截图验收。
 */
export function isReadingProtectionEnabled() {
  return import.meta.env.PROD
}
