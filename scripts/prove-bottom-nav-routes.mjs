import {
  PATHS_WITH_BOTTOM_NAV,
  shouldRenderAppBottomNavDock,
} from '../src/lib/bottomNavRoutes.js'

console.log('PATHS_WITH_BOTTOM_NAV=', JSON.stringify(PATHS_WITH_BOTTOM_NAV, null, 2))

const contactPath = '/contact-us'
const showBottomNav = shouldRenderAppBottomNavDock(contactPath, {
  searchExploreOpen: false,
  filterPanelOpen: false,
  homeSearchInputFocused: false,
})

console.log('Contact Us route:', contactPath)
console.log('showBottomNav:', showBottomNav)
console.log('renders AppBottomNavDock:', showBottomNav ? 'YES' : 'NO')

if (showBottomNav !== true) {
  process.exit(1)
}
