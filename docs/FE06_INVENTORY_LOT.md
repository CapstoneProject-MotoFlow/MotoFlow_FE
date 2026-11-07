# FE-06 — Inventory and Lot Management

Nhánh: `feature/FE-06-inventory-lot-management`.
Nền: FE `origin/main` tại `21d40ae`; hợp đồng API: BE `origin/main` tại `df4b1f4`.
Nhánh này độc lập với FE-05/PR #24, không thay thế hoặc xóa code FE-05.

## Màn và API đã nối

- `/inventory`: Owner xem toàn chuỗi/chọn kho; BM chỉ xem kho của mình. Lọc tìm kiếm, nhóm, khu vực, tồn bằng 0 và cảnh báo; phân trang server. Bốn thẻ số lượng dùng `/inventory/stock/summary`, không cộng từ trang đang mở. Mỗi kết quả/thống kê của BE là một phụ tùng tại một kho.
- Mở một phụ tùng để xem các lô/trạng thái từ `/inventory/stock/{storeId}/{productId}`. Giá trị tồn, giá vốn bình quân và giá nhập chỉ hiển thị với Owner.
- Popup vị trí và ngưỡng tồn dùng PUT `/inventory/stock/{storeId}/{productId}/location` và `/low-stock-threshold`. Ngưỡng 0 được giữ là 0; để trống gửi null. Lưu xong tải lại tồn, thống kê và khu vực.
- Tra tồn liên kho của Owner dùng `/inventory/availability`.
- `/inventory/movements`: lọc kho, phụ tùng, lô, loại biến động, khoảng ngày; phân trang; biến động nhóm theo ngày; mở lô và chứng từ phiếu nhập gốc.
- `/inventory/lots`: bốn nhóm sắp hết hạn/hết hạn/còn hàng/hết hàng; lọc kho, tìm kiếm, nguồn, ngày nhận. Owner có lọc NCC qua tìm kiếm API thực. Không gọi API danh sách NCC bằng BM vì endpoint chỉ cho Owner.
- `/inventory/lots/:id`: nguồn, nhà cung cấp, ngày nhập/SX/hạn dùng, tồn tại kho theo trạng thái, 10 biến động gần nhất và thứ tự xuất FEFO/FIFO từ BE; bỏ qua lô bị đánh dấu skipped. Owner chọn kho và xem giá nhập.
- Popup cảnh báo hạn dùng của Owner dùng GET/PUT `/inventory/expiry-warning`, hiển thị bản hiện hành, bản chờ và lịch sử, kiểm tra số ngày 1–365 và ngày áp dụng.
- Menu Owner/BM đã dẫn tới các màn mới; URL `/owner/inventory` và `/owner/inventory/movements` vẫn mở được. Staff không có quyền vào nhóm màn này.
- Sửa đường dẫn refresh về `/api/v1/auth/refresh` để phiên đăng nhập khớp API main.

## Phần mockup còn phụ thuộc BE

- Chưa có số dư sau mỗi biến động, tổng nhập/xuất đầy đủ trong kỳ, số dư đầu/cuối và biểu đồ tồn theo ngày. Không suy ra các số này từ một trang lịch sử.
- Chưa có thống kê giá trị tồn toàn chuỗi/từng kho, phân trang nhóm SKU toàn chuỗi hoặc sắp xếp theo giá trị. Bảng hiện giữ đúng kết quả phụ tùng/kho và thứ tự phân trang BE.
- Danh sách lô không trả giá nhập; giá nhập có ở chi tiết lô, không tải N+1 để ghép vào danh sách.
- BM chưa có endpoint tra cứu danh sách NCC nên chưa có bộ chọn NCC tương đương Owner.
- Chứng từ gốc hiện mở được phiếu nhập (GET `/goods-receipt-notes/{id}`). Các nguồn bán hàng/điều chuyển/kiểm kê/điều chỉnh hiển thị mã tham chiếu; không dựng đường dẫn tới màn chưa triển khai.
- Chưa có API xuất Excel của các màn này.
- Inventory Posting, Low Stock Warning, Near Expiry Warning và File Upload Service thuộc BE. FE đọc tồn/cảnh báo đã có; không thêm dịch vụ ghi sổ hoặc tác vụ nền giả ở FE.

Không thêm dữ liệu mẫu, số liệu giả, tab điều hướng thử nghiệm hoặc banner kỹ thuật vào màn nghiệp vụ.

## Kiểm tra

- Build TypeScript/Vite; ESLint (không có lỗi; 15 cảnh báo cũ ngoài module inventory); 17 test hiện có.
- Kiểm tra trình duyệt với API local thật bằng Owner và BM Cầu Giấy: tồn kho, mở lô, chi tiết lô, lịch sử theo lô, popup vị trí/ngưỡng/hạn dùng; kiểm tra ẩn giá vốn với BM.
- Kiểm tra gửi ngưỡng 0 bằng chặn request lưu trên trình duyệt, không sửa database thực.
- Kiểm tra chiều rộng 390px: không tràn trang, bảng cuộn ngang bên trong.
- BE local chạy main mới trên database đang dùng tại `artifacts/receiving-be/.dev-postgres`; không tạo database mới và không sửa working tree BE gốc.

Các kiểm tra trên không xác nhận mọi nhánh nghiệp vụ BE hoặc thay thế một đợt kiểm thử tích hợp đầy đủ.

## Bổ sung giao diện kiểm kê — UC-90 đến UC-95, UC-105

- Đã fetch lại BE main: vẫn `df4b1f4`. Có entity/repository `StockCount`, `StockCountLine`, `StockCountRequest`; chưa có controller/service/DTO API phục vụ danh sách, yêu cầu, tạo phiếu, chi tiết, giao việc, bắt đầu đếm, lưu/gửi số đếm hoặc phê duyệt kiểm kê.
- `/stock-counts` mở cho Owner/BM/Staff; menu dẫn tới màn này. Các cột và tab theo vai trò: Owner chờ duyệt và xem các kho; BM phiếu kho mình và yêu cầu của Owner; Staff việc cần đếm/đã gửi, không có sổ sách, chênh lệch hoặc giá vốn.
- Popup Owner yêu cầu kiểm kê và BM tạo phiếu có toàn kho/khu vực/một số phụ tùng, ngày hoặc lý do. Bộ chọn dùng API kho/khu vực/phụ tùng thật. Đổi kho xóa các lựa chọn phụ tùng/khu vực trước đó.
- `/stock-counts/:id` đã dựng bố cục thông tin, tiến độ, dòng kiểm kê, lịch sử và thanh thao tác theo vai trò. Staff chỉ có thông tin cần đếm và số đếm của mình.
- `/stock-counts/:id/record` dành cho Staff/BM, dựng bảng đếm mù theo vị trí, lô/hạn dùng, ô số đếm, ghi chú, chỉ dòng chưa đếm và cam kết. Chuẩn bị giao diện trước lúc bắt đầu/đã gửi/không còn được đếm. Có popup chọn Excel cho phiếu đầu kỳ; chưa tải tệp hoặc đọc tệp vào phiếu.
- **Chưa nối nghiệp vụ kiểm kê:** không có API tương ứng; không gửi tới endpoint tự đặt tên, không tạo phiếu/dòng mẫu, không báo lưu/gửi thành công. Nút tạo/gửi/lưu/duyệt hiện khóa. Các trang không tự lấy entity trong database hoặc dựng phiếu theo mã trên URL. `stockCountModel.ts` chỉ là model hiển thị tạm của FE, không phải hợp đồng DTO BE đã xác nhận.
- Chưa có popup giao việc/xác minh/duyệt có dữ liệu thực; cần DTO và quy tắc hành động từ BE để hoàn thiện các thao tác này. Chưa áp điều kiện kỳ kho từ ngày cố định trong mockup.
- Ba test bổ sung kiểm tra chưa đếm khác số 0, chỉ nhận số nguyên không âm trong giới hạn, và yêu cầu số đếm/ghi chú ở mọi dòng kèm cam kết (tổng 20 test đạt). Kiểm tra trình duyệt Owner/BM/Staff không có lỗi JavaScript; popup chọn được phụ tùng thật, nút gửi khóa; không gọi API kiểm kê chưa tồn tại. Kiểm tra bố cục trang tại 390px không tràn ngang.
