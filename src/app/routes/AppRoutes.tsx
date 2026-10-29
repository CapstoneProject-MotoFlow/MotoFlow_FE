import CustomersPage from '../../modules/customers/pages/CustomersPage'
import CustomerDetailPage from '../../modules/customers/pages/CustomerDetailPage'
import ProfilePage from '../../modules/profile/pages/ProfilePage'
import OwnerWorkspacePage from '../../modules/owner/pages/OwnerWorkspacePage'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import LoginPage from '../../modules/auth/pages/LoginPage'
import ForgotPasswordPage from '../../modules/auth/pages/ForgotPasswordPage'
import ChangePasswordPage from '../../modules/auth/pages/ChangePasswordPage'
import DashboardPage from '../../modules/dashboard/pages/DashboardPage'
import AccountsPage from '../../modules/admin/pages/AdminAccountsPage'
import AdminPermissionHistoryPage from '../../modules/admin/pages/AdminPermissionHistoryPage'
import StoresPage from '../../modules/stores/pages/StoresPage'
import ProfileChangePasswordPage from '../../modules/profile/pages/ProfileChangePasswordPage'
import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import RequireAuth from '../guards/RequireAuth'
import RequireRole from '../guards/RequireRole'
import RequirePasswordChange from '../guards/RequirePasswordChange'

function RootRedirect() {
  const { user } = useAuth()
  return <Navigate to={!user ? '/login' : user.mustChangePassword ? '/change-password' : '/dashboard'} replace />
}

export default function AppRoutes() {
  const { user } = useAuth()
  return <Routes>
    <Route path="/" element={<RootRedirect />} />
    <Route element={<AuthLayout />}>
      <Route path="/login" element={user ? <RootRedirect /> : <LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    </Route>
    <Route element={<RequireAuth allowPasswordChange />}>
      <Route element={<AuthLayout />}><Route path="/change-password" element={<RequirePasswordChange><ChangePasswordPage /></RequirePasswordChange>} /></Route>
    </Route>
    <Route element={<RequireAuth />}>
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route element={<RequireRole roles={['OWNER']} />}><Route path="/owner/products" element={<OwnerWorkspacePage />} /><Route path="/owner/customers" element={<CustomersPage />} /><Route path="/owner/customers/:id" element={<CustomerDetailPage />} /></Route>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/change-password" element={<ProfileChangePasswordPage />} />
        <Route element={<RequireRole roles={['ADMIN', 'OWNER']} />}><Route path="/stores" element={<StoresPage />} /></Route>
        <Route element={<RequireRole roles={['ADMIN']} />}>
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/permission-history" element={<AdminPermissionHistoryPage />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<RootRedirect />} />
  </Routes>
}
