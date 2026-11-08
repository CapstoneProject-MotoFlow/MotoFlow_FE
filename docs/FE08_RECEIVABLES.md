# FE-08 — Công nợ khách hàng

Nhánh: feature/FE-08-receivables-management. Phạm vi UC-62 đến UC-67 theo ảnh WBS ngày 08/11/2026; dùng bố cục và thành phần giao diện hiện có.

- /receivables: danh sách còn nợ, tìm khách, chỉ quá hạn, phân trang server; Owner lọc cửa hàng/toàn chuỗi, BM do BE giới hạn cửa hàng.
- /receivables/customers/:id: dư nợ theo phạm vi và toàn chuỗi, khoản nợ còn mở/quá hạn/tất cả, hạn trả, điều chỉnh, số đã thu, lịch sử và phân bổ thu nợ.
- Popup thu nợ gọi preview BE; giữ nguyên snapshot số dư và phân bổ khi xác nhận. Không tự tính thứ tự phân bổ. Hỗ trợ tiền mặt, tiền thối, chuyển khoản và mã giao dịch, chọn khoản nợ hoặc để BE phân bổ tự động.
- Owner cấp/thu hồi mua chịu có lý do và ghi nợ đầu kỳ theo cửa hàng, số tiền, hạn trả, diễn giải, chứng từ bắt buộc. Popup có trên chi tiết công nợ và hồ sơ khách hàng.
- Staff không được mở route công nợ. Chống gửi lặp; BE kiểm quyền và số dư cuối cùng. Khi lỗi ghi tiền phải xem preview lại.

Dùng API /receivables/customers và /customers/:id/{debts,credit/grant,credit/revoke,opening-debts,debt-payments/preview,debt-payments}. Migration DB thuộc BE đã có, không tạo migration FE. Tải chứng từ dùng dịch vụ ATTACHMENT có sẵn; cần Cloudinary được cấu hình để ghi nợ đầu kỳ.

Kiểm tra: build, lint và test tự động. Chưa kiểm thử giao dịch thu nợ/ghi nợ thật trên trình duyệt; ảnh đính kèm là phạm vi WBS, không phải mockup màn chi tiết.

## Đối chiếu mockup HTML

Đã đọc screens_debt.js và screens_customers.js từ bộ MotoFlow_UI_ToanBo: áp dụng palette brand #465fff, card bo 16px, bảng sáng, badge quyền mua chịu/trạng thái khoản nợ, thẻ khách bốn trường, tab có số lượng, lịch sử 10 lần và Xem tất cả. Thêm chọn khách và ghi nợ đầu kỳ từ danh sách; liên kết Thu nợ mở popup một lần. Popup có chế độ tự phân bổ/chỉ định, bước preview BE, xác nhận đã nhận tiền, nội dung giải thích cấp/thu hồi quyền.

Phụ thuộc BE để khớp đủ mockup: API tổng hợp tổng phải thu/quá hạn/đến hạn 7 ngày và bộ lọc dueSoon; danh sách khách nợ chưa trả tên cửa hàng theo khách. Thẻ tổng quan hiển thị dấu — và thông báo chưa có số liệu, không cộng riêng một trang rồi gọi là tổng. Chưa có bộ lọc 7 ngày vì API chưa hỗ trợ. Chưa kiểm tra trực quan trên trình duyệt hoặc ghi giao dịch thật.

## Bổ sung sau rà soát API

Đã hiển thị chứng từ khoản nợ/phiếu thu, người ghi nợ, ngày tất toán, số dư hiện tại trong phân bổ. Popup thu nợ hỗ trợ chứng từ, tiền khách đưa, tiền thối và chặn tiền thiếu. Preview tự tải từ BE trong cùng popup; xác nhận trước khi ghi thu. Không sửa BE/database.

Kèm sửa R-02 FE-07: gửi status cùng view/page/size và dùng phân trang BE, bỏ tải toàn bộ danh sách. Kiểm tra cuối: build đạt, 59/59 test đạt, lint module mới đạt. Chưa kiểm thử giao dịch thật hoặc xác minh trực quan trên trình duyệt.
