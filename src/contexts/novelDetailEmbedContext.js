import { createContext, useContext } from 'react'

/** 首页书本详情 Overlay 内嵌 ReaderPage：共用顶栏、不重复 header */
export const NovelDetailEmbedContext = createContext(null)

export function useNovelDetailEmbed() {
  return useContext(NovelDetailEmbedContext)
}
