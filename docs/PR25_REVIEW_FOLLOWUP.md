# Xử lý review PR #25 — 07/11/2026

## Trạng thái Git được kiểm chứng

PR #25 vẫn open/chưa merge tại thời điểm sửa. Đã fetch FE main (36d0221, gồm PR #24), merge vào nhánh FE-06 bằng commit 0a95c27. Giữ route FE-05 và FE-06; axiosClient theo main; OwnerPermissionsPage giữ readManagers và kết quả PUT của FE-06. Không mở PR mới trùng nội dung.

## Đối chiếu lỗi

| Mục               | Kết quả                                                                                                                                                                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01              | Đã giải quyết ba conflict; main là tổ tiên của nhánh FE-06.                                                                                                                                                                                                                                                      |
| R-02 phần lô      | Bỏ useLotCollection tải hết lô. Danh sách dùng bộ lọc/phân trang BE (20 dòng); chi tiết chỉ truy vấn q=lotId; lịch sử chỉ tải lô khi đã chọn phụ tùng, theo SKU (tối đa 100 kết quả, không tải toàn bộ lịch sử lô). Bỏ xem trước số lô ở popup cấu hình để tránh tải cả danh sách và tính sai theo ngày áp dụng. |
| R-02 phần tồn kho | Còn chờ BE, theo mục 5.1/6.8 review. BE origin/main e795f95 chưa có API gom/phân trang phụ tùng và tổng giá trị Owner. Chưa xóa useCompleteStock hoặc giả lập hợp đồng mới. Còn hạn chế tải toàn bộ stock và tải lại sau lưu.                                                                                    |
| R-03              | Cộng giá trị đã biết; tồn rỗng chưa có giá đóng góp 0; hàng có tồn hoặc đang chuyển mà chưa có giá được đánh dấu “Chưa đủ giá vốn” ở tổng và từng dòng.                                                                                                                                                          |
| R-04              | Nút Lô mở StockLots ngay dưới dòng kho/phụ tùng cho Owner/BM; đọc tồn theo lô/trạng thái và tra liên kho, giá chỉ Owner.                                                                                                                                                                                         |
| R-05              | Owner/BM mở PO, GRN và sai lệch NCC vào các route FE-05. Staff GRN vẫn xem popup; REPLENISHMENT_REQUEST chờ FE-09, chưa tạo link.                                                                                                                                                                                |
| R-06              | Phạm vi WHOLE/PRODUCTS/AREA; lý do/ghi chú kiểm kê tối đa 255 ký tự.                                                                                                                                                                                                                                             |
| R-07              | Giữ menu kiểm kê; thông báo rõ chờ API BE; bỏ tổng số phiếu/phân trang giữ chỗ.                                                                                                                                                                                                                                  |
| R-08              | Không hiện hủy/xác minh/duyệt khi chưa có phiếu; không cho URL action mở các popup này khi chưa có trạng thái phù hợp. Giữ Giao việc và API warehouse-tasks như PM đã chốt; BE kiểm tra documentId và quyền.                                                                                                     |
| R-09              | Ẩn khối tổng hợp/biểu đồ lịch sử, cột tồn sau, giá vốn danh sách lô, số đã nhận của lô hết hàng khi BE không trả dữ liệu.                                                                                                                                                                                        |
| R-10              | Còn chờ đợt API gom tồn theo mục 6.8 review; chưa báo hoàn tất.                                                                                                                                                                                                                                                  |
| R-11              | Hiển thị fieldErrors chi tiết khi BE kiểm tra dữ liệu không hợp lệ.                                                                                                                                                                                                                                              |
| R-12              | Tìm tồn kho/lô dùng replace URL để không thêm mục lịch sử theo mỗi phím.                                                                                                                                                                                                                                         |
| R-13              | Tiêu đề ngày đã có colSpan theo showBalance (giữ bản đúng); màn lịch sử hiện không bật cột tồn sau chưa được BE cung cấp.                                                                                                                                                                                        |
| R-14              | Mã gõ tay không bị ghi đè khi chọn khu vực/tầng/ô; mã cũ ngoài phạm vi chọn vẫn giữ nguyên và các ô chọn để trống.                                                                                                                                                                                               |

Bổ sung: lazy-load bốn trang inventory; màn ghi số đếm được remount theo dữ liệu phiếu để không truy cập values chưa được khởi tạo khi phiếu đến sau render đầu.

## Hợp đồng kiểm kê cần BE chốt

DTO riêng cho Staff phải loại bookQty/unitCost, không chỉ ẩn giao diện. Các trường UI cần thống nhất: code, note (theo dòng), unitCost, importedFileName, automaticallyCompleted, sourceLabel, lotCode, recountReason (cấp phiếu). Cần chốt nơi lưu giá vốn đầu kỳ, schema/DTO và nguồn tạo phiếu. File này là danh sách để review, chưa gửi tin nhắn tới người khác và chưa tự tạo endpoint/migration.

## Kiểm tra và giới hạn

Build/lint/test sau merge; smoke-test route FE-05 và FE-06, số request lô, chờ BE, tồn theo lô, mã vị trí gõ tay. Không lưu dữ liệu thử vào DB. Giao việc là thao tác ghi duy nhất đang bật trong phần kiểm kê; các API phiếu kiểm kê còn thiếu. Các thao tác tồn/vị trí/ngưỡng/hạn dùng và đọc thông báo vẫn dùng API hiện có.
