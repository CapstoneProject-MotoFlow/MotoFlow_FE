/**
 * File: app/routes/AppRoutes.tsx
 * Loại: CẤU HÌNH ĐIỀU HƯỚNG — nối URL với các màn hình.
 * Công dụng: Ánh xạ URL sang page; chọn trang chủ theo vai trò; ghép guard/layout; lazy-load page và hiển thị trạng thái chờ bằng Suspense.
 */
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import RequireAuth from '../guards/RequireAuth'
import RequireRole from '../guards/RequireRole'
import RequireCatalogEdit from '../guards/RequireCatalogEdit'
import RequirePasswordChange from '../guards/RequirePasswordChange'

const NotificationsPage = lazy(
  () => import('../../modules/notifications/NotificationsPage'),
)
const BranchCustomersPage = lazy(
  () => import('../../modules/branch-manager/pages/BranchCustomersPage'),
)
const PartCategoriesPage = lazy(
  () => import('../../modules/catalog/pages/PartCategoriesPage'),
)
const OwnerPermissionsPage = lazy(
  () => import('../../modules/owner/pages/OwnerPermissionsPage'),
)
const ProductDetailPage = lazy(
  () => import('../../modules/catalog/pages/ProductDetailPage'),
)
const VehicleModelsPage = lazy(
  () => import('../../modules/catalog/pages/VehicleModelsPage'),
)
const SupplierDetailPage = lazy(
  () => import('../../modules/suppliers/pages/SupplierDetailPage'),
)
const StaffProductsPage = lazy(
  () => import('../../modules/staff/pages/StaffProductsPage'),
)
const StaffOverview = lazy(
  () => import('../../modules/staff/pages/StaffOverview'),
)
const BranchProductsPage = lazy(
  () => import('../../modules/branch-manager/pages/BranchProductsPage'),
)
const BranchManagerOverview = lazy(
  () => import('../../modules/branch-manager/pages/BranchManagerOverview'),
)
const ProductCreatePage = lazy(
  () => import('../../modules/owner/pages/ProductCreatePage'),
)
const SuppliersPage = lazy(
  () => import('../../modules/suppliers/pages/SuppliersPage'),
)
const CustomersPage = lazy(
  () => import('../../modules/customers/pages/CustomersPage'),
)
const CustomerDetailPage = lazy(
  () => import('../../modules/customers/pages/CustomerDetailPage'),
)
const ProfilePage = lazy(
  () => import('../../modules/profile/pages/ProfilePage'),
)
const OwnerWorkspacePage = lazy(
  () => import('../../modules/owner/pages/OwnerWorkspacePage'),
)
const LoginPage = lazy(() => import('../../modules/auth/pages/LoginPage'))
const ForgotPasswordPage = lazy(
  () => import('../../modules/auth/pages/ForgotPasswordPage'),
)
const ChangePasswordPage = lazy(
  () => import('../../modules/auth/pages/ChangePasswordPage'),
)
const DashboardPage = lazy(
  () => import('../../modules/dashboard/pages/DashboardPage'),
)
const AccountsPage = lazy(
  () => import('../../modules/admin/pages/AdminAccountsPage'),
)
const AdminPermissionHistoryPage = lazy(
  () => import('../../modules/admin/pages/AdminPermissionHistoryPage'),
)
const StoresPage = lazy(() => import('../../modules/stores/pages/StoresPage'))
const ProfileChangePasswordPage = lazy(
  () => import('../../modules/profile/pages/ProfileChangePasswordPage'),
)

/** RootRedirect: Chọn trang đích theo trạng thái đăng nhập và yêu cầu đổi mật khẩu. */
function RootRedirect() {
  const { user } = useAuth()
  return (
    <Navigate
      to={
        !user
          ? '/login'
          : user.mustChangePassword
            ? '/change-password'
            : '/dashboard'
      }
      replace
    />
  )
}

/** AppRoutes: Ánh xạ URL sang page; chọn trang chủ theo vai trò; ghép guard/layout; lazy-load page và hiển thị trạng thái chờ bằng Suspense. */
export default function AppRoutes() {
  const { user } = useAuth()
  return (
    <Suspense fallback={<p role="status">Đang tải trang…</p>}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route element={<AuthLayout />}>
          <Route
            path="/login"
            element={user ? <RootRedirect /> : <LoginPage />}
          />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        <Route element={<RequireAuth allowPasswordChange />}>
          <Route element={<AuthLayout />}>
            <Route
              path="/change-password"
              element={
                <RequirePasswordChange>
                  <ChangePasswordPage />
                </RequirePasswordChange>
              }
            />
          </Route>
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<DashboardLayout />}>
            <Route
              path="/dashboard"
              element={
                user?.role === 'BRANCH_MANAGER' ? (
                  <BranchManagerOverview />
                ) : user?.role === 'STAFF' ? (
                  <StaffOverview />
                ) : (
                  <DashboardPage />
                )
              }
            />
            <Route element={<RequireRole roles={['OWNER']} />}>
              <Route
                path="/owner/catalog-permissions"
                element={<OwnerPermissionsPage />}
              />
              <Route path="/owner/suppliers" element={<SuppliersPage />} />
              <Route
                path="/owner/suppliers/:id"
                element={<SupplierDetailPage />}
              />
              <Route
                path="/owner/categories"
                element={<PartCategoriesPage />}
              />
              <Route path="/owner/vehicles" element={<VehicleModelsPage />} />
              <Route
                path="/owner/products/:id/edit"
                element={<ProductCreatePage />}
              />
              <Route
                path="/owner/products/:id"
                element={<ProductDetailPage />}
              />
              <Route path="/owner/products" element={<OwnerWorkspacePage />} />
              <Route
                path="/owner/inventory"
                element={<OwnerWorkspacePage inventory />}
              />
              <Route
                path="/owner/products/new"
                element={<ProductCreatePage />}
              />
              <Route path="/owner/customers" element={<CustomersPage />} />
              <Route
                path="/owner/customers/:id/debts"
                element={<CustomerDetailPage debtView />}
              />
              <Route
                path="/owner/customers/:id"
                element={<CustomerDetailPage />}
              />
            </Route>
            <Route element={<RequireRole roles={['BRANCH_MANAGER']} />}>
              <Route element={<RequireCatalogEdit />}>
                <Route
                  path="/branch-manager/categories"
                  element={<PartCategoriesPage />}
                />
                <Route
                  path="/branch-manager/vehicles"
                  element={<VehicleModelsPage />}
                />
              </Route>
              <Route
                path="/branch-manager/customers"
                element={<BranchCustomersPage />}
              />
              <Route
                path="/branch-manager/customers/:id/debts"
                element={<CustomerDetailPage debtView />}
              />
              <Route
                path="/branch-manager/customers/:id"
                element={<CustomerDetailPage />}
              />
              <Route
                path="/branch-manager/products/new"
                element={<ProductCreatePage />}
              />
              <Route
                path="/branch-manager/products/:id/edit"
                element={<ProductCreatePage />}
              />
              <Route
                path="/branch-manager/products/:id"
                element={<ProductDetailPage />}
              />
              <Route
                path="/branch-manager/products"
                element={<BranchProductsPage />}
              />
            </Route>
            <Route element={<RequireRole roles={['STAFF']} />}>
              <Route
                path="/staff/products/:id"
                element={<ProductDetailPage />}
              />
              <Route path="/staff/products" element={<StaffProductsPage />} />
            </Route>
            <Route
              element={
                <RequireRole roles={['OWNER', 'BRANCH_MANAGER', 'STAFF']} />
              }
            >
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/profile/change-password"
              element={<ProfileChangePasswordPage />}
            />
            <Route element={<RequireRole roles={['ADMIN', 'OWNER']} />}>
              <Route path="/stores" element={<StoresPage />} />
            </Route>
            <Route element={<RequireRole roles={['ADMIN']} />}>
              <Route path="/accounts" element={<AccountsPage />} />
              <Route
                path="/permission-history"
                element={<AdminPermissionHistoryPage />}
              />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Suspense>
  )
}
