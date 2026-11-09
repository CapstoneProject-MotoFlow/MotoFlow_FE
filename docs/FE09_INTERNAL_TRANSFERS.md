# FE-09 — Bổ sung và điều chuyển nội bộ

Nhánh feature/FE-09-internal-stock-transfers, kế thừa nhánh FE-08. Chỉ sửa FE; không sửa BE hoặc database.

## Màn hình

- /replenishment-requests: danh sách lọc trạng thái, cửa hàng Owner, khoảng ngày và phân trang BE.
- /replenishment-requests/new: tạo yêu cầu theo cửa hàng, tìm phụ tùng, số lượng và lý do.
- /replenishment-requests/:id: số yêu cầu/kế hoạch/đã nhận/chuyển mua/còn thiếu, phiếu liên quan, chuyển phần thiếu sang mua và lập phiếu điều chuyển.
- /transfer-orders: danh sách theo phạm vi BE trả, trạng thái, kho nguồn Owner, ngày và phân trang.
- /transfer-orders/new: tạo trực tiếp hoặc từ yêu cầu bổ sung; chọn nguồn/đích, phụ tùng, số lượng, xem tồn nguồn qua availability.
- /transfer-orders/:id: kế hoạch, đã soạn/xuất/nhận/trả/mất/chưa xử lý, lô xuất, phiếu nhận, sai lệch; xác nhận xuất và đóng phiếu qua preview BE.
- /transfer-orders/:id/prepare: giao việc, nhập số soạn và lý do thiếu.
- /transfer-orders/:id/extra: xác nhận số xuất thừa và lý do.
- /transfer-orders/:id/receipts/:receiptId: giao kiểm nhận, nhập số đạt/hỏng, gửi, kiểm lại, xác nhận nhận hàng.
- Popup quyết định nhận sau/trả nguồn/mất, nhận trả về nguồn. Mất yêu cầu mã điều chỉnh có sẵn; không tự tạo điều chỉnh tồn ở FE.

## Kiểm tra và giới hạn

Build, lint module và 61 test tự động đã đạt ở lượt kiểm tra. Chưa kiểm thử nghiệp vụ thực tế bằng các tài khoản Owner/BM/Staff hoặc xác minh giao diện trong trình duyệt. Cần đối chiếu thêm mockup trực quan; hiện tái sử dụng kiểu card/bảng/form sáng của ứng dụng.

Các điểm cần hoàn thiện tiếp: tải chứng từ xuất thừa; hiện đầy đủ hướng dẫn lô ưu tiên trong màn soạn; lọc kho đích trên danh sách. Quyền thao tác điều phối vẫn được BE xác thực cuối cùng; FE chưa có trường central trong phiên đăng nhập nên một số nút BM vẫn hiển thị và có thể nhận từ chối quyền từ BE.

Đã bổ sung tra tồn cửa hàng và nút thêm các phụ tùng dưới ngưỡng bằng API low-stock-suggestions.

## Bổ sung theo rà soát API 09/11/2026

Đã sửa khởi tạo số xuất thừa về 0; tách quyền quyết định xử lý thiếu và nhận trả về nguồn. Bổ sung chứng từ xuất thừa, hiển thị chứng từ đã lưu/giá vốn Owner/thời điểm xác nhận xuất thừa, hướng dẫn vị trí-mã vạch-lô ưu tiên trong soạn hàng, preview lô xuất và bảng đối soát khi đóng. Các mã chặn đóng thường gặp đã đổi sang mô tả tiếng Việt.

Màn kiểm nhận có thêm thực nhận, hàng thừa và thời điểm/người ghi-xác nhận (API chỉ trả id người dùng ở phiếu nhận). Staff có liên kết nhận hàng lấy trạng thái phiếu nhận thật. Form tạo lệnh có trường chọn lệnh gốc và vụ sai lệch theo phụ tùng để gửi makeupForCaseId.

Chưa xác minh toàn bộ bằng giao dịch thật trên trình duyệt. Quyền và kiểm tra tồn cuối cùng vẫn do BE thực hiện. Không sửa BE hoặc database.
