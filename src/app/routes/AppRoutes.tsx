/**
 * File: app/routes/AppRoutes.tsx
 * Loại: CẤU HÌNH ĐIỀU HƯỚNG — nối URL với các màn hình.
 * Công dụng: Ánh xạ URL sang page; chọn trang chủ theo vai trò; ghép guard/layout; lazy-load page và hiển thị trạng thái chờ bằng Suspense.
 */
import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import { canCoordinateTransfers } from '../../shared/utils/roles'
import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import RequireAuth from '../guards/RequireAuth'
import RequireRole from '../guards/RequireRole'
import RequireCatalogEdit from '../guards/RequireCatalogEdit'
import RequirePasswordChange from '../guards/RequirePasswordChange'

const PriceListPage = lazy(() => import('../../modules/pricing/PriceListPage'))
const PricingRulesPage = lazy(
  () => import('../../modules/pricing/PricingRulesPage'),
)
const ReplenishmentCoordinatePage = lazy(
  () => import('../../modules/transfers/ReplenishmentCoordinatePage'),
)

const SalesOrderListPage = lazy(() =>
  import('../../modules/sales/SalesPages').then((m) => ({
    default: m.SalesOrderListPage,
  })),
)
const SalesOrderFormPage = lazy(() =>
  import('../../modules/sales/SalesPages').then((m) => ({
    default: m.SalesOrderFormPage,
  })),
)
const SalesOrderDetailPage = lazy(() =>
  import('../../modules/sales/SalesPages').then((m) => ({
    default: m.SalesOrderDetailPage,
  })),
)
const RecordPickedPage = lazy(() =>
  import('../../modules/sales/SalesPages').then((m) => ({
    default: m.RecordPickedPage,
  })),
)
const UnmetDemandPage = lazy(() =>
  import('../../modules/sales/SalesPages').then((m) => ({
    default: m.UnmetDemandPage,
  })),
)
const LotsPage = lazy(() => import('../../modules/inventory/LotsPage'))
const LotDetailPage = lazy(
  () => import('../../modules/inventory/LotDetailPage'),
)
const InventoryMovementsPage = lazy(
  () => import('../../modules/inventory/InventoryMovementsPage'),
)
const InventoryPage = lazy(
  () => import('../../modules/inventory/InventoryPage'),
)
const StockCountListPage = lazy(
  () => import('../../modules/inventory/StockCountListPage'),
)
const StockCountDetailPage = lazy(
  () => import('../../modules/inventory/StockCountDetailPage'),
)
const StockCountRecordPage = lazy(
  () => import('../../modules/inventory/StockCountRecordPage'),
)
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
const ResolveSupplierDiscrepancyPage = lazy(
  () => import('../../modules/suppliers/pages/ResolveSupplierDiscrepancyPage'),
)
const ExcessReceiptsPage = lazy(
  () => import('../../modules/receiving/ExcessReceiptsPage'),
)
const PurchaseOrdersPage = lazy(
  () => import('../../modules/receiving/PurchaseOrdersPage'),
)
const NewPurchaseOrderPage = lazy(() =>
  import('../../modules/receiving/PurchaseOrderFormsPage').then((module) => ({
    default: module.NewPurchaseOrderPage,
  })),
)
const EditPurchaseOrderPage = lazy(() =>
  import('../../modules/receiving/PurchaseOrderFormsPage').then((module) => ({
    default: module.EditPurchaseOrderPage,
  })),
)
const NewGoodsReceiptPage = lazy(() =>
  import('../../modules/receiving/PurchaseOrderFormsPage').then((module) => ({
    default: module.NewGoodsReceiptPage,
  })),
)
const GoodsReceiptPage = lazy(() =>
  import('../../modules/receiving/LiveReceiptPage').then((module) => ({
    default: module.GoodsReceiptPage,
  })),
)
const PurchaseOrderDetailPage = lazy(() =>
  import('../../modules/receiving/PurchaseOrdersPage').then((module) => ({
    default: module.PurchaseOrderDetailPage,
  })),
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
const ReceivableListPage = lazy(() =>
  import('../../modules/receivables/ReceivablePages').then((m) => ({
    default: m.ReceivableListPage,
  })),
)
const ReceivableDetailPage = lazy(() =>
  import('../../modules/receivables/ReceivablePages').then((m) => ({
    default: m.ReceivableDetailPage,
  })),
)
const TransferListPage = lazy(() =>
  import('../../modules/transfers/TransferPages').then((m) => ({
    default: m.TransferListPage,
  })),
)
const ReplenishmentDetailPage = lazy(() =>
  import('../../modules/transfers/TransferPages').then((m) => ({
    default: m.ReplenishmentDetailPage,
  })),
)
const TransferCreatePage = lazy(
  () => import('../../modules/transfers/TransferCreatePage'),
)
const TransferDetailPage = lazy(
  () => import('../../modules/transfers/TransferDetailPage'),
)
const TransferWorkPage = lazy(
  () => import('../../modules/transfers/TransferWorkPage'),
)
const PastDateStockPage = lazy(
  () => import('../../modules/inventory/PastDateStockPage'),
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

function InventoryLegacyRedirect({
  movements = false,
}: {
  movements?: boolean
}) {
  const location = useLocation()
  return (
    <Navigate
      to={'/inventory' + (movements ? '/movements' : '') + location.search}
      replace
    />
  )
}

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
function RequireTransferCoordinator() {
  const { user } = useAuth()
  return canCoordinateTransfers(user) ? (
    <Outlet />
  ) : (
    <Navigate to="/transfer-orders" replace />
  )
}

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
            <Route
              element={<RequireRole roles={['OWNER', 'BRANCH_MANAGER']} />}
            >
              <Route path="/inventory" element={<InventoryPage />} />
              <Route
                path="/inventory/movements"
                element={<InventoryMovementsPage />}
              />
              <Route path="/inventory/lots" element={<LotsPage />} />
              <Route path="/inventory/lots/:id" element={<LotDetailPage />} />
              <Route
                path="/supplier-discrepancies"
                element={<ResolveSupplierDiscrepancyPage />}
              />
            </Route>
            <Route
              element={
                <RequireRole roles={['OWNER', 'BRANCH_MANAGER', 'STAFF']} />
              }
            >
              <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
              <Route
                path="/goods-receipt-notes/:id"
                element={<GoodsReceiptPage />}
              />
            </Route>
            <Route
              element={<RequireRole roles={['OWNER', 'BRANCH_MANAGER']} />}
            >
              <Route
                path="/purchase-orders/:id"
                element={<PurchaseOrderDetailPage />}
              />
            </Route>
            <Route element={<RequireRole roles={['OWNER']} />}>
              <Route path="/pricing/rules" element={<PricingRulesPage />} />
              <Route
                path="/purchase-orders/new"
                element={<NewPurchaseOrderPage />}
              />
              <Route
                path="/goods-receipt-notes/excess"
                element={<ExcessReceiptsPage />}
              />
              <Route
                path="/purchase-orders/:id/edit"
                element={<EditPurchaseOrderPage />}
              />
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
              <Route
                path="/owner/products"
                element={<OwnerWorkspacePage key="products" />}
              />
              <Route
                path="/owner/inventory"
                element={<InventoryLegacyRedirect />}
              />
              <Route
                path="/owner/inventory/movements"
                element={<InventoryLegacyRedirect movements />}
              />
              <Route
                path="/owner/products/new"
                element={<ProductCreatePage />}
              />
              <Route path="/owner/customers" element={<CustomersPage />} />
              <Route
                path="/owner/customers/:id/debts"
                element={<ReceivableDetailPage />}
              />
              <Route
                path="/owner/customers/:id"
                element={<CustomerDetailPage />}
              />
            </Route>
            <Route element={<RequireRole roles={['BRANCH_MANAGER']} />}>
              <Route
                path="/purchase-orders/:id/receipts/new"
                element={<NewGoodsReceiptPage />}
              />
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
                element={<ReceivableDetailPage />}
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
              <Route path="/transfer-orders" element={<TransferListPage />} />
              <Route
                path="/transfer-orders/:id"
                element={<TransferDetailPage />}
              />
              <Route
                path="/transfer-orders/:id/prepare"
                element={<TransferWorkPage />}
              />
              <Route
                path="/transfer-orders/:id/receipts/:receiptId"
                element={<TransferWorkPage mode="receipt" />}
              />
              <Route path="/sales-orders" element={<SalesOrderListPage />} />
              <Route
                path="/sales-orders/:id"
                element={<SalesOrderDetailPage />}
              />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/stock-counts" element={<StockCountListPage />} />
              <Route
                path="/stock-counts/:id"
                element={<StockCountDetailPage />}
              />
            </Route>
            <Route
              element={<RequireRole roles={['STAFF', 'BRANCH_MANAGER']} />}
            >
              <Route
                path="/stock-counts/:id/record"
                element={<StockCountRecordPage />}
              />
            </Route>
            <Route
              element={<RequireRole roles={['OWNER', 'BRANCH_MANAGER']} />}
            >
              <Route
                path="/sales-orders/new"
                element={<SalesOrderFormPage />}
              />
              <Route
                path="/sales-orders/:id/edit"
                element={<SalesOrderFormPage />}
              />
            </Route>
            <Route
              element={<RequireRole roles={['STAFF', 'BRANCH_MANAGER']} />}
            >
              <Route
                path="/sales-orders/:id/pick"
                element={<RecordPickedPage />}
              />
            </Route>
            <Route
              element={<RequireRole roles={['OWNER', 'BRANCH_MANAGER']} />}
            >
              <Route
                path="/replenishment-requests"
                element={<TransferListPage replenishment />}
              />
              <Route
                path="/replenishment-requests/new"
                element={<TransferCreatePage replenishment />}
              />
              <Route element={<RequireTransferCoordinator />}>
                <Route
                  path="/replenishment-requests/:id/coordinate"
                  element={<ReplenishmentCoordinatePage />}
                />
                <Route
                  path="/transfer-orders/new"
                  element={<TransferCreatePage />}
                />
              </Route>
              <Route
                path="/replenishment-requests/:id"
                element={<ReplenishmentDetailPage />}
              />
              <Route
                path="/transfer-orders/:id/extra"
                element={<TransferWorkPage mode="extra" />}
              />
              <Route
                path="/inventory/past-date-stock"
                element={<PastDateStockPage />}
              />
              <Route path="/receivables" element={<ReceivableListPage />} />
              <Route
                path="/pricing/retail-prices"
                element={<PriceListPage />}
              />
              <Route
                path="/receivables/customers/:id"
                element={<ReceivableDetailPage />}
              />
              <Route path="/unmet-demand" element={<UnmetDemandPage />} />
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
import '../../modules/operations/operational-pages.css'
