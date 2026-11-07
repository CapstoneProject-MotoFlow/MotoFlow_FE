# FE-06 — Inventory and Lot Management

Nhánh: `feature/FE-06-inventory-lot-management`.
Nền: FE `origin/main` tại `21d40ae`; hợp đồng API: BE `origin/main` tại `df4b1f4`.
Nhánh này độc lập với FE-05/PR #24, không thay thế hoặc xóa code FE-05.

## Màn và API đã nối

- `/inventory`: Owner xem toàn chuỗi theo phụ tùng, mở ra từng kho; khi chọn kho hoặc BM xem thì bảng phẳng có ô kệ. FE đọc đủ các trang `/inventory/stock` (100 dòng/request) rồi mới gom theo productId, cộng giá trị và phân trang 20 phụ tùng. Bốn thẻ đếm SKU phân biệt, không đếm trùng cùng SKU ở nhiều kho. Không cộng tổng từ riêng trang đang mở.
- Dòng phụ tùng toàn chuỗi không mở bảng lô: mở các dòng kho con theo mockup. Nút Lịch sử/Vị trí/Ngưỡng nằm tại từng kho. Lô/trạng thái/giá nhập xem tại các màn lô; giá trị chỉ Owner thấy.
- Popup vị trí và ngưỡng tồn dùng PUT `/inventory/stock/{storeId}/{productId}/location` và `/low-stock-threshold`. Ngưỡng 0 được giữ là 0; để trống gửi null. Lưu xong tải lại tồn, thống kê và khu vực.
- Owner tra tồn liên kho bằng cách mở dòng phụ tùng; các số mỗi kho và tổng đều lấy từ đầy đủ kết quả API tồn.
- `/inventory/movements`: lọc kho, phụ tùng, lô, loại biến động, khoảng ngày; phân trang; biến động nhóm theo ngày; mở lô và chứng từ phiếu nhập gốc.
- `/inventory/lots`: bốn nhóm sắp hết hạn/hết hạn/còn hàng/hết hàng; lọc kho, tìm kiếm, nguồn, ngày nhận. Owner có lọc NCC qua tìm kiếm API thực. Không gọi API danh sách NCC bằng BM vì endpoint chỉ cho Owner.
- `/inventory/lots/:id`: nguồn, nhà cung cấp, ngày nhập/SX/hạn dùng, tồn tại kho theo trạng thái, 10 biến động gần nhất và thứ tự xuất FEFO/FIFO từ BE; bỏ qua lô bị đánh dấu skipped. Owner chọn kho và xem giá nhập.
- Popup cảnh báo hạn dùng của Owner dùng GET/PUT `/inventory/expiry-warning`, hiển thị bản hiện hành, bản chờ và lịch sử, kiểm tra số ngày 1–365 và ngày áp dụng.
- Menu Owner/BM đã dẫn tới các màn mới; URL `/owner/inventory` và `/owner/inventory/movements` vẫn mở được. Staff không có quyền vào nhóm màn này.
- Sửa đường dẫn refresh về `/api/v1/auth/refresh` để phiên đăng nhập khớp API main.

## Phần mockup còn phụ thuộc BE

- Chưa có số dư sau mỗi biến động, tổng nhập/xuất đầy đủ trong kỳ, số dư đầu/cuối và biểu đồ tồn theo ngày. Không suy ra các số này từ một trang lịch sử.
- BE chưa có API gom nhóm SKU/tổng giá trị trực tiếp. FE đã xử lý trên toàn bộ các trang thật, có sắp xếp tên/giá trị và phân trang SKU. Khi dữ liệu lớn, nên chuyển tổng hợp/phân trang nhóm về BE để giảm lượng tải. Nếu tải thiếu/trùng dòng hoặc tổng số dòng đổi giữa các trang thì không công bố tổng một phần.
- Danh sách lô không trả giá nhập; giá nhập có ở chi tiết lô, không tải N+1 để ghép vào danh sách.
- BM chưa có endpoint tra cứu danh sách NCC nên chưa có bộ chọn NCC tương đương Owner.
- Chứng từ gốc hiện mở được phiếu nhập (GET `/goods-receipt-notes/{id}`). Nguồn kiểm kê dẫn tới `/stock-counts/:id` (giao diện chờ API chi tiết); bán hàng/điều chuyển/điều chỉnh hiện mã tham chiếu.
- Chưa có API xuất Excel của các màn này.
- Inventory Posting, Low Stock Warning, Near Expiry Warning và File Upload Service thuộc BE. FE đọc tồn/cảnh báo đã có; không thêm dịch vụ ghi sổ hoặc tác vụ nền giả ở FE.

Không thêm dữ liệu mẫu, số liệu giả, tab điều hướng thử nghiệm hoặc banner kỹ thuật vào màn nghiệp vụ.

## Kiểm tra

- Build TypeScript/Vite; ESLint (không có lỗi; 13 cảnh báo cũ); 29 test, gồm quy tắc số đếm và kiểm tra HTML không lộ sổ sách/giá vốn với Staff.
- Kiểm tra trình duyệt với API local thật bằng Owner và BM Cầu Giấy: tồn kho, mở lô, chi tiết lô, lịch sử theo lô, popup vị trí/ngưỡng/hạn dùng; kiểm tra ẩn giá vốn với BM.
- Kiểm tra gửi ngưỡng 0 bằng chặn request lưu trên trình duyệt, không sửa database thực.
- Kiểm tra chiều rộng 390px: không tràn trang, bảng cuộn ngang bên trong.
- BE local chạy main mới trên database đang dùng tại `artifacts/receiving-be/.dev-postgres`; không tạo database mới và không sửa working tree BE gốc.

Các kiểm tra trên không xác nhận mọi nhánh nghiệp vụ BE hoặc thay thế một đợt kiểm thử tích hợp đầy đủ.

## Bổ sung giao diện kiểm kê — UC-90 đến UC-95, UC-105

- Đã fetch lại BE main: vẫn `df4b1f4`. Có entity/repository `StockCount`, `StockCountLine`, `StockCountRequest`; chưa có controller/service/DTO API phục vụ danh sách, yêu cầu, tạo phiếu, chi tiết, bắt đầu đếm, lưu/gửi số đếm hoặc phê duyệt kiểm kê.
- `/stock-counts` mở cho Owner/BM/Staff; menu dẫn tới màn này. Các cột và tab theo vai trò: Owner chờ duyệt và xem các kho; BM phiếu kho mình và yêu cầu của Owner; Staff việc cần đếm/đã gửi, không có sổ sách, chênh lệch hoặc giá vốn.
- Popup Owner yêu cầu kiểm kê và BM tạo phiếu có toàn kho/khu vực/một số phụ tùng, ngày hoặc lý do. Bộ chọn dùng API kho/khu vực/phụ tùng thật. Đổi kho xóa các lựa chọn phụ tùng/khu vực trước đó.
- `/stock-counts/:id` đã dựng bố cục thông tin, tiến độ, dòng kiểm kê, lịch sử và thanh thao tác theo vai trò. Staff chỉ có thông tin cần đếm và số đếm của mình.
- `/stock-counts/:id/record` dành cho Staff/BM, dựng bảng đếm mù theo vị trí, lô/hạn dùng, ô số đếm, ghi chú, chỉ dòng chưa đếm và cam kết. Chuẩn bị giao diện trước lúc bắt đầu/đã gửi/không còn được đếm. Có popup chọn Excel cho phiếu đầu kỳ; chưa tải tệp hoặc đọc tệp vào phiếu.
- **Các thao tác kiểm kê ngoài giao việc chưa nối:** không có API tương ứng; không gửi tới endpoint tự đặt tên, không tạo phiếu/dòng mẫu, không báo lưu/gửi thành công. Nút tạo/gửi/lưu/duyệt hiện khóa. Các trang không tự lấy entity trong database hoặc dựng phiếu theo mã trên URL. `stockCountModel.ts` chỉ là model hiển thị tạm của FE, không phải hợp đồng DTO BE đã xác nhận.
- Đã bổ sung popup giao việc, xác minh nguyên nhân/bỏ dòng/trả đếm lại, duyệt/trả đếm lại, hủy có lý do, nhập giá vốn đầu kỳ/Excel. Popup xác minh/duyệt/hủy/giá vốn cho xem bố cục và nhập thông tin nhưng khóa gửi khi chưa có API. Chưa áp điều kiện kỳ kho từ ngày cố định trong mockup.
- Giao người đếm dùng API chung có sẵn: GET/POST `/warehouse-tasks`, `taskType=COUNTING`, `documentId`, `assigneeId`. Chỉ cho BM; BE xác thực phiếu thuộc kho và trạng thái cho phép. Hiển thị người đủ điều kiện, số việc, lịch sử và thông báo chặn từ BE. GET lỗi hoặc không có phiếu thì không cho lưu. Không tạo thêm phiếu để kiểm tra.
- Ba test bổ sung kiểm tra chưa đếm khác số 0, chỉ nhận số nguyên không âm trong giới hạn, và yêu cầu số đếm/ghi chú ở mọi dòng kèm cam kết (tổng 20 test đạt). Kiểm tra trình duyệt Owner/BM/Staff không có lỗi JavaScript; popup chọn được phụ tùng thật, nút gửi khóa; không gọi API kiểm kê chưa tồn tại. Kiểm tra bố cục trang tại 390px không tràn ngang.

- Đã kiểm tra popup Owner/BM/Staff ở desktop/390px. Giao việc đọc phiếu thực từ BE, kiểm tra payload POST bằng chặn lưu trả lỗi có chủ đích; không đổi người được giao trong database.
- Lịch sử đã có bố cục tổng nhập/xuất/tồn đầu-cuối và biểu đồ gập/mở; chưa có dữ liệu tổng hợp nên hiện dấu — và trạng thái chưa có dữ liệu, không vẽ đường giả. Owner có ô giá trị tồn theo kho, tính từ toàn bộ các trang API thật; chỉ hiện — nếu chưa tải đủ hoặc có giá trị chưa biết. Xuất Excel và báo hủy lô hết hạn hiển thị nhưng khóa do chưa có nghiệp vụ tương ứng.
- Bảng đối chiếu từng màn: `FE06_SCREEN_COVERAGE.md`.

## Chỉnh màn tồn kho đúng cấu trúc mockup

- Gom theo phụ tùng toàn chuỗi; các dòng kho con nền nhạt, thụt đầu dòng, ba nút ngang. Không chèn bảng lô vào dòng phụ tùng.
- Gom thẻ đếm và giá trị theo kho vào cùng khung; thanh lọc một hàng ở desktop với tìm kiếm trước bộ chọn kho, nhóm, khu vực, sắp xếp, hiện tồn bằng 0.
- Tìm kiếm ở header và trong bảng cùng dùng q qua BE, hỗ trợ SKU/tên/OEM/ô kệ theo khả năng tìm của BE.
- 5 test mới kiểm tra gom qua nhiều trang, giữ đủ kho khi lọc thiếu hàng, không đổi giá trị chưa biết thành 0, không cộng hàng đang chuyển vào tồn thực tế, không xuất tổng khi phân trang thiếu/trùng/thay đổi, sắp xếp và tồn bằng 0.
- Kiểm tra trình duyệt Owner (87 dòng kho/phụ tùng thực), BM Cầu Giấy (29 dòng): tổng dòng cha bằng tổng kho con, tìm kiếm, đổi kho, sắp xếp, popup vị trí và các nút không vượt ô ở 1900/1440/1280/390px.

## Nối các API đã có trên BE main

- Thông báo chuyển sang GET `/notifications` với `page`, `size`, `unreadOnly`; dùng `read` từ response để hiển thị đã đọc/chưa đọc. Trang thông báo phân trang 20 dòng, chuông lấy 5 thông báo chưa đọc và tổng chưa đọc từ API. Không giới hạn trang thông báo ở 5 dòng `/home` nữa.
- Nối POST `/notifications/{id}/read` và `/notifications/read-all`. Lưu thành công mới tải lại số chưa đọc trên trang/chuông; lỗi giữ thông báo và cho thử lại. Thay đổi URL/bộ lọc không đọc trạng thái checkbox từ sự kiện đã kết thúc.
- Thông báo PRODUCT mở chi tiết phụ tùng theo vai trò; LOT chỉ Owner/BM; STOCK_COUNT mở màn kiểm kê; STOCK_COUNT_REQUEST mở danh sách cho Owner/BM. Phiếu nhập GOODS_RECEIPT_NOTE mở dialog dùng GET thật. Nguồn chưa có màn không sinh đường dẫn giả.
- Owner có nút “Tra tồn có thể bán” tại chi tiết phụ tùng, gọi GET `/inventory/availability?productIds=...`; hiển thị số có thể bán tại kho đang hoạt động, loại hàng hết hạn, không thay thế số khả dụng vật lý ở bảng tồn kho.
- Upload signature chỉ cho ảnh/PDF, không thay thế API nhập Excel kiểm kê. Chưa thêm upload vào nơi BE chưa có nghiệp vụ lưu tệp.
- Hai job LOW_STOCK/NEAR_EXPIRY/LOT_EXPIRED nằm trên nhánh BE `feature/iter2-barcode-jobs`, chưa main; FE đã có điều hướng PRODUCT/LOT tương ứng khi nhận thông báo. Không tự merge/chạy job hoặc tạo thông báo thử trong database.
- Build, ESLint (0 lỗi, 13 cảnh báo cũ), 29 test đạt. Browser kiểm tra GET thông báo với Owner/BM/Staff; API tồn có thể bán với Owner; thử lỗi/lưu đọc từng mục/đọc tất cả/đồng bộ chuông/mở kiểm kê/390px bằng phản hồi lưu chặn trong trình duyệt. Không POST đánh dấu đọc vào database thực khi kiểm tra.
