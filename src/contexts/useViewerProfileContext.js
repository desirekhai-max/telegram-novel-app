import { useContext } from 'react'
import { ViewerProfileContext } from './viewerProfileContext.js'

export function useViewerProfileContext() {
  const ctx = useContext(ViewerProfileContext)
  if (!ctx) {
    throw new Error('useViewerProfileContext must be used within ViewerProfileProvider')
  }
  return ctx
}
