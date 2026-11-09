# Tổng quan BM theo mockup

- Sáu thẻ theo bố cục 3 × 2: đơn bán, hàng nhập, điều chuyển, bổ sung hàng, kiểm kê và điều chỉnh chưa gửi.
- Các thẻ có màn nghiệp vụ liên kết tới danh sách tương ứng. Điều chỉnh chưa có API/màn hoàn chỉnh nên giữ —, không gắn nút mở chức năng giả.
- Số liệu shortcut lấy từ home; kiểm kê tính tổng phiếu nháp/đang đếm và yêu cầu Owner đang chờ trong phạm vi BM. Bổ sung ở BM chưa có shortcut tương ứng giữ —.
- Bảng trái hợp nhất tối đa 5 việc từ các trang chứng từ gần đây, có mô tả và đường dẫn hành động; cột thời điểm dùng ngày tạo hoặc gửi kết quả API cung cấp. Không gọi đây là việc chờ lâu nhất toàn hệ thống vì BE chưa có hàng đợi hợp nhất.
- Bên phải Theo dõi: doanh số chưa có API giữ —; số dòng tồn dưới ngưỡng và lô sắp hết hạn dùng API hiện có.
- Tạo kiểm kê từ yêu cầu trên dashboard mở danh sách kèm action/requestId; form lấy prefill theo quyền trước khi cho lưu, không tự tạo chứng từ khi mở.

Kiểm tra: build đạt, 69/69 test đạt; lint không lỗi (1 cảnh báo effect đã tồn tại trong BranchManagerOverview). Browser API mô phỏng: 6 thẻ, liên kết, bảng công việc và Theo dõi, desktop/mobile không tràn ngang, không lỗi JavaScript. Không ghi DB thật.
