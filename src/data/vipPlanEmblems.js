/**
 * VIP 套餐左侧图标配置
 *
 * 优先级：短视频 MP4 > 自定义静图 > 内置 CSS 立体书动效
 *
 * 【如何换成真实视频】
 * 1. 从 Pixabay / Pexels 下载「阅读 / 书本」类 MP4（尽量选暗色背景）
 * 2. 放进 public/vip/ 命名为 emblem-entry.mp4 等
 * 3. 在下面 VIP_PLAN_VIDEO_SRC 填路径；留空则用 CSS 立体书
 */
export const VIP_PLAN_EMBLEM_SRC = {
  vip_entry: '',
  vip_standard: '',
  vip_premium: '',
}

/** 留空 = 使用下方 CSS 立体书；有 MP4 时自动播循环视频 */
export const VIP_PLAN_VIDEO_SRC = {
  vip_entry: '',
  vip_standard: '',
  vip_premium: '',
}

/** 已停用 Lottie（社区素材多带白底） */
export const VIP_PLAN_LOTTIE_SRC = {
  vip_entry: '',
  vip_standard: '',
  vip_premium: '',
}
