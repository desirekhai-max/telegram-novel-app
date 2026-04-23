import { useContext } from 'react'
import { AppChromeContext } from './appChromeContext.js'

export function useAppChrome() {
  const ctx = useContext(AppChromeContext)
  if (!ctx) {
    throw new Error('useAppChrome must be used within AppChromeProvider')
  }
  return ctx
}
