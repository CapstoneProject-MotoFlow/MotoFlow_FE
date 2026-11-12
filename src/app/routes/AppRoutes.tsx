/**
 * File: app/routes/AppRoutes.tsx
 * Loại: CẤU HÌNH ĐIỀU HƯỚNG — nối URL với các màn hình.
 * Công dụng: Ánh xạ URL sang page; chọn trang chủ theo vai trò; ghép guard/layout.
 */
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import { canCoordinateTransfers } from '../../shared/utils/roles'
import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import RequireAuth from '../guards/RequireAuth'
import RequireRole from '../guards/RequireRole'
import RequireCatalogEdit from '../guards/RequireCatalogEdit'
import RequirePasswordChange from '../guards/RequirePasswordChange'

import AccountsPage from '../../modules/admin/pages/AdminAccountsPage'
import AdminPermissionHistoryPage from '../../modules/admin/pages/AdminPermissionHistoryPage'
import ChangePasswordPage from '../../modules/auth/pages/ChangePasswordPage'
import LoginPage from '../../modules/auth/pages/LoginPage'
import BranchCustomersPage from '../../modules/branch-manager/pages/BranchCustomersPage'
import BranchManagerOverview from '../../modules/branch-manager/pages/BranchManagerOverview'
import BranchProductsPage from '../../modules/branch-manager/pages/BranchProductsPage'
import PartCategoriesPage from '../../modules/catalog/pages/PartCategoriesPage'
import ProductDetailPage from '../../modules/catalog/pages/ProductDetailPage'
import VehicleModelsPage from '../../modules/catalog/pages/VehicleModelsPage'
import CustomerDetailPage from '../../modules/customers/pages/CustomerDetailPage'
import CustomersPage from '../../modules/customers/pages/CustomersPage'
import DashboardPage from '../../modules/dashboard/pages/DashboardPage'
import InventoryMovementsPage from '../../modules/inventory/InventoryMovementsPage'
import InventoryPage from '../../modules/inventory/InventoryPage'
import LotDetailPage from '../../modules/inventory/LotDetailPage'
import LotsPage from '../../modules/inventory/LotsPage'
import PastDateStockPage from '../../modules/inventory/PastDateStockPage'
import StockCountDetailPage from '../../modules/inventory/StockCountDetailPage'
import StockCountListPage from '../../modules/inventory/StockCountListPage'
import StockCountRecordPage from '../../modules/inventory/StockCountRecordPage'
import NotificationsPage from '../../modules/notifications/NotificationsPage'
import OwnerPermissionsPage from '../../modules/owner/pages/OwnerPermissionsPage'
import OwnerWorkspacePage from '../../modules/owner/pages/OwnerWorkspacePage'
import ProductCreatePage from '../../modules/owner/pages/ProductCreatePage'
import PriceListPage from '../../modules/pricing/PriceListPage'
import PricingRulesPage from '../../modules/pricing/PricingRulesPage'
import ProfileChangePasswordPage from '../../modules/profile/pages/ProfileChangePasswordPage'
import ProfilePage from '../../modules/profile/pages/ProfilePage'
import {
  ReceivableListPage,
  ReceivableDetailPage,
} from '../../modules/receivables/ReceivablePages'
import ExcessReceiptsPage from '../../modules/receiving/ExcessReceiptsPage'
import { GoodsReceiptPage } from '../../modules/receiving/LiveReceiptPage'
import {
  NewPurchaseOrderPage,
  EditPurchaseOrderPage,
  NewGoodsReceiptPage,
} from '../../modules/receiving/PurchaseOrderFormsPage'
import PurchaseOrdersPage, {
  PurchaseOrderDetailPage,
} from '../../modules/receiving/PurchaseOrdersPage'
import {
  SalesOrderListPage,
  SalesOrderFormPage,
  SalesOrderDetailPage,
  RecordPickedPage,
  UnmetDemandPage,
} from '../../modules/sales/SalesPages'
import StaffOverview from '../../modules/staff/pages/StaffOverview'
import StaffProductsPage from '../../modules/staff/pages/StaffProductsPage'
import StoresPage from '../../modules/stores/pages/StoresPage'
import ResolveSupplierDiscrepancyPage from '../../modules/suppliers/pages/ResolveSupplierDiscrepancyPage'
import SupplierDetailPage from '../../modules/suppliers/pages/SupplierDetailPage'
import SuppliersPage from '../../modules/suppliers/pages/SuppliersPage'
import ManagerTransferListPage from '../../modules/transfers/ManagerTransferListPage'
import ReplenishmentCoordinatePage from '../../modules/transfers/ReplenishmentCoordinatePage'
import ReplenishmentListPage from '../../modules/transfers/ReplenishmentListPage'
import StaffTransferListPage from '../../modules/transfers/StaffTransferListPage'
import TransferCreatePage from '../../modules/transfers/TransferCreatePage'
import TransferDetailPage from '../../modules/transfers/TransferDetailPage'
import { ReplenishmentDetailPage } from '../../modules/transfers/TransferPages'
import TransferWorkPage from '../../modules/transfers/TransferWorkPage'

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

/** AppRoutes: Ánh xạ URL sang page; chọn trang chủ theo vai trò; ghép guard/layout. */
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
          <Route element={<RequireRole roles={['OWNER', 'BRANCH_MANAGER']} />}>
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
          <Route element={<RequireRole roles={['OWNER', 'BRANCH_MANAGER']} />}>
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
            <Route path="/owner/categories" element={<PartCategoriesPage />} />
            <Route path="/owner/vehicles" element={<VehicleModelsPage />} />
            <Route
              path="/owner/products/:id/edit"
              element={<ProductCreatePage />}
            />
            <Route path="/owner/products/:id" element={<ProductDetailPage />} />
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
            <Route path="/owner/products/new" element={<ProductCreatePage />} />
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
            <Route path="/staff/products/:id" element={<ProductDetailPage />} />
            <Route path="/staff/products" element={<StaffProductsPage />} />
          </Route>
          <Route
            element={
              <RequireRole roles={['OWNER', 'BRANCH_MANAGER', 'STAFF']} />
            }
          >
            <Route
              path="/transfer-orders"
              element={
                user?.role === 'STAFF' ? (
                  <StaffTransferListPage />
                ) : (
                  <ManagerTransferListPage />
                )
              }
            />
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
          <Route element={<RequireRole roles={['STAFF', 'BRANCH_MANAGER']} />}>
            <Route
              path="/stock-counts/:id/record"
              element={<StockCountRecordPage />}
            />
          </Route>
          <Route element={<RequireRole roles={['OWNER', 'BRANCH_MANAGER']} />}>
            <Route path="/sales-orders/new" element={<SalesOrderFormPage />} />
            <Route
              path="/sales-orders/:id/edit"
              element={<SalesOrderFormPage />}
            />
          </Route>
          <Route element={<RequireRole roles={['STAFF', 'BRANCH_MANAGER']} />}>
            <Route
              path="/sales-orders/:id/pick"
              element={<RecordPickedPage />}
            />
          </Route>
          <Route element={<RequireRole roles={['OWNER', 'BRANCH_MANAGER']} />}>
            <Route
              path="/replenishment-requests"
              element={<ReplenishmentListPage />}
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
            <Route path="/pricing/retail-prices" element={<PriceListPage />} />
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
  )
}
import '../../modules/operations/operational-pages.css'
