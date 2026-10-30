import BusinessSidebarNav from './BusinessSidebarNav'
export default function BranchManagerSidebarNav(props: {
  collapsed: boolean
  onNotice: (message: string) => void
}) {
  return <BusinessSidebarNav {...props} owner={false} />
}
