import { useContext } from 'react'
import { MainTabShellContext } from '../contexts/mainTabShellContext.js'

export function useMainTabShell() {
  return useContext(MainTabShellContext)
}
