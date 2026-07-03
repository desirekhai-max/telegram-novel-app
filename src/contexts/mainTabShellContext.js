import { createContext } from 'react'

/** 底栏三 Tab 共用 AppMainTabToolbar，子页面不再各自渲染顶栏 */
export const MainTabShellContext = createContext(false)
