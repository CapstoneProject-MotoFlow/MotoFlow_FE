# FE-07 — cập nhật triển khai 08/11/2026

Đã nối với BE main e795f95:

- POST preview/create, PUT update kèm version; giữ khách hàng/số điện thoại khi sửa, chọn kho khi Owner tạo đơn. Preview có loading/lỗi, priced và withinThreshold; không cho lưu khi thiếu giá hoặc vượt ngưỡng.
- GET versions với nội dung từng phiên bản chỉ đọc; dữ liệu đơn hiện tại và actions từ BE quyết định thao tác.
- PICKING: SKU/mã vạch, lý do thiếu, PUT picked-lines kèm version; nháp lưu trong sessionStorage theo đơn và phiên bản, ghi rõ chưa gửi.
- Xác nhận số giao kèm customerAgreed/version.
- Thu tiền/hoàn tiền có phương thức, mã chuyển khoản, xác nhận tiền; gửi expectedPayable/expectedRefundable. Thu tiền mặt hỗ trợ tiền khách đưa.
- Bán chịu có số còn phải thu, hạn trả và cam kết. Hủy hỗ trợ hoàn tiền trong cùng request. Xác minh/từ chối khoản tiền và thử hoàn tất lại.
- Các form có khóa gửi lặp và lỗi từ BE; tải lại đơn sau thao tác. SettlementResult.completionBlockedMessage được giữ để thông báo đã ghi tiền nhưng chưa hoàn tất.
- Owner tạo/sửa; BM được giao có thể vào màn nhặt; quyền thao tác theo actions. Cột cần làm dùng nextAction.
- Bộ lọc trạng thái chính xác: do BE chưa có tham số status, khi lọc FE tải đủ collection theo view rồi lọc và phân trang; không lọc riêng một trang với total sai. Có thể cần API status phía BE khi số đơn lớn.
- Nhu cầu: lọc khách/phụ tùng/ngày; tạo đơn được điền trước khách, phụ tùng, số thiếu và kho; tạo yêu cầu bổ sung thật qua API replenishment-requests.
- Camera BarcodeDetector khi trình duyệt hỗ trợ, dừng stream khi đóng; có thông báo dùng máy quét/nhập mã nếu không hỗ trợ.

Giới hạn hợp đồng BE:

- SalesOrderRequest/Update chưa có note; đã bỏ ô nhập ghi chú không lưu để tránh mất nội dung âm thầm. Muốn lưu ghi chú như mockup cần bổ sung hợp đồng BE.
- Bản BE này chưa có controller cho nhặt phiếu điều chuyển; không tự đặt endpoint. Giao diện nhặt FE-07 hiện phục vụ đơn bán.

Kiểm tra:

- Build, lint phần sales, test hiện có (54 bài).
- Database test riêng fe07_test_20261108 là bản sao dữ liệu demo; BE test cổng 8081. Không thay đổi đơn demo trong motoflow_dev_v1.
- Thử API thật: tạo/sửa, giao PICKING, ghi nhặt, xác nhận, thu tiền hoàn tất, hủy; thay đổi số yêu cầu/giao thiếu tạo 3 phiên bản; bán chịu hoàn tất; khoản thu chờ xác minh, xác minh, hoàn tiền và hủy kèm hoàn phần tiền còn lại đều đạt.
- Đây là kiểm thử hợp đồng API và kiểm tra code/build, chưa thay thế kiểm thử tương tác trình duyệt toàn bộ form hay camera trên thiết bị thật.

Chưa commit/push. Xem FE07_AUDIT_2026-11-08.md để đối chiếu danh sách phát hiện lịch sử; các mục đã nối phía trên thay thế trạng thái chưa làm trong báo cáo đó.
