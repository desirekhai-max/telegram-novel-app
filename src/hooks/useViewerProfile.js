import { useViewerProfileContext } from '../contexts/useViewerProfileContext.js'

/** 全局会员资料（见 ViewerProfileProvider）：各 Tab 共用缓存，避免重复请求与方案标签闪烁 */
export function useViewerProfile() {
  return useViewerProfileContext()
}
