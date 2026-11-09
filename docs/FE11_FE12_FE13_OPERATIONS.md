# Thông báo, giao việc, mã vạch và tồn ngày quá khứ (FE-11/12/13)

Nhánh feature/notifications-barcode-stock-history, kế thừa FE-09. Chỉ sửa FE.

Cập nhật sau rà FE05–FE13: dashboard Owner/BM/Staff đã nối danh sách chứng từ và cảnh báo tồn/hạn dùng có API; tạo/sửa đơn bán dùng barcode lookup chính xác rồi lấy chi tiết/giá; tồn ngày đã thêm categoryId. Luồng kiểm kê thường đã nối. Xem báo cáo FE05_FE13_API_AUDIT_2026-11-09.md. Kiểm tra trình duyệt dùng API mô phỏng, không ghi DB thật.

FE-11: danh sách thông báo, chưa đọc/đã đọc, đánh dấu một/tất cả đã có từ trước; bổ sung mở lệnh điều chuyển và yêu cầu bổ sung. Popup WarehouseAssignmentDialog dùng chung PICKING, INSPECTION, DISPATCH_PREPARATION, COUNTING; quyền/nhân viên/lịch sử lấy từ warehouse-tasks. BE gửi thông báo cho người được giao, FE không tự tạo thông báo giả.

FE-12: BarcodeScan tra chính xác products/barcode/{code}, hỗ trợ máy quét USB/Bluetooth gửi Enter và BarcodeDetector camera có kiểm tra trình duyệt/quyền. Đã dùng trong chọn phụ tùng nhận hàng, tìm dòng kiểm nhận GRN, soạn/kiểm nhận điều chuyển, chọn phụ tùng bổ sung/chuyển kho. Bán hàng đã có máy quét/camera và tiếp tục dùng luồng hiện có. Không tự tăng số lượng sau quét; người dùng nhập số đếm thực tế.

FE-13: màn /inventory/past-date-stock, chọn ngày quá khứ và kho (Owner chọn kho, BM theo kho của mình), tìm phụ tùng, bao gồm tồn 0, phân trang BE và hiển thị kỳ cơ sở. JOB-04 là phần BE: phiên bản hiện tại không có tác vụ snapshot cuối ngày, API tính từ kỳ kho và biến động (InventoryServiceImpl). Không gắn nhãn dữ liệu là snapshot khi BE không cung cấp.

Chưa kiểm thử camera trên thiết bị thật hoặc thực hiện giao việc thật bằng tài khoản BM/Staff. Không sửa BE/database. Các API camera cần HTTPS hoặc localhost và trình duyệt hỗ trợ BarcodeDetector; có nhập mã/máy quét làm phương án thay thế.

Màn tìm phụ tùng Owner/BM/Staff cũng mở chi tiết bằng mã vạch. Thông báo INSPECTION của BE dùng GOODS_RECEIPT_NOTE cho cả nhập nhà cung cấp và nhận điều chuyển, thiếu transferOrderId. FE kiểm tra phiếu trước khi mở; nếu không có phiếu nhập nhà cung cấp, hiển thị đường dẫn danh sách điều chuyển thay vì mở sai màn. Cần BE bổ sung tham chiếu lệnh cha để mở thẳng phiếu điều chuyển từ thông báo.
