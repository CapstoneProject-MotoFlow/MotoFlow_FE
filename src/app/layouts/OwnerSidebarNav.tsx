import BusinessSidebarNav from './BusinessSidebarNav'
export default function OwnerSidebarNav(props: {
  collapsed: boolean
  onNotice: (message: string) => void
}) {
  return <BusinessSidebarNav {...props} owner={true} />
}
