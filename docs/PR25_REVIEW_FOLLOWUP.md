# Xử lý review PR #25 — 07/11/2026

## Trạng thái Git được kiểm chứng

PR #25 vẫn open/chưa merge tại thời điểm sửa. Đã fetch FE main (36d0221, gồm PR #24), merge vào nhánh FE-06 bằng commit 0a95c27. Giữ route FE-05 và FE-06; axiosClient theo main; OwnerPermissionsPage giữ readManagers và kết quả PUT của FE-06. Không mở PR mới trùng nội dung.

## Bổ sung sau lần rà lại

- BM và Owner chọn một kho dùng phân trang BE 20 dòng, không gọi useCompleteStock. Chỉ chế độ Owner toàn chuỗi còn dùng tải đầy đủ để giữ đúng nhóm/tổng đến khi BE có API gom.
- Thẻ số liệu dùng /stock/summary với cùng q/categoryId/storageArea/storeId. R-10 đã sửa phía FE.
- PUT vị trí/ngưỡng dùng StockRowResponse cập nhật dòng; chỉ làm mới summary/khu vực. Khi đang lọc theo từ khóa/khu vực/trạng thái thì tải lại phạm vi lọc để kiểm tra dòng còn thuộc kết quả hay không. Không tải lại toàn bộ base stock sau mỗi lần lưu.
- Tìm ở thanh đầu trang đã dùng replace URL. R-13 sửa colSpan và có test 8/9 cột.
- Chuông lazy-load ReceiptDialog, có Suspense.
- Bổ sung test giao việc: quyền/đúng phiếu/người hợp lệ, payload COUNTING, không gửi khi blocked/loading hoặc lựa chọn cũ, lỗi BE được truyền lên. Đã kiểm tra popup trên trình duyệt bằng cách chặn POST, không ghi DB.
- Owner khi chọn một kho không hiển thị các tổng giá trị toàn chuỗi không được tải đầy đủ; vẫn có giá trị từng dòng và bộ chọn kho. Tổng giá trị Owner mới còn chờ API gom.

## Đối chiếu lỗi

| Mục               | Kết quả                                                                                                                                                                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01              | Đã giải quyết ba conflict; main là tổ tiên của nhánh FE-06.                                                                                                                                                                                                                                                      |
| R-02 phần lô      | Bỏ useLotCollection tải hết lô. Danh sách dùng bộ lọc/phân trang BE (20 dòng); chi tiết chỉ truy vấn q=lotId; lịch sử chỉ tải lô khi đã chọn phụ tùng, theo SKU (tối đa 100 kết quả, không tải toàn bộ lịch sử lô). Bỏ xem trước số lô ở popup cấu hình để tránh tải cả danh sách và tính sai theo ngày áp dụng. |
| R-02 phần tồn kho | BM/Owner một kho phân trang BE; PUT cập nhật dòng, chỉ làm mới các kết quả phụ thuộc. Chỉ Owner toàn chuỗi còn chờ API gom để bỏ tải đầy đủ.                                                                                                                                                                     |
| R-03              | Cộng giá trị đã biết; tồn rỗng chưa có giá đóng góp 0; hàng có tồn hoặc đang chuyển mà chưa có giá được đánh dấu “Chưa đủ giá vốn” ở tổng và từng dòng.                                                                                                                                                          |
| R-04              | Nút Lô mở StockLots ngay dưới dòng kho/phụ tùng cho Owner/BM; đọc tồn theo lô/trạng thái và tra liên kho, giá chỉ Owner.                                                                                                                                                                                         |
| R-05              | Owner/BM mở PO, GRN và sai lệch NCC vào các route FE-05. Staff GRN vẫn xem popup; REPLENISHMENT_REQUEST chờ FE-09, chưa tạo link.                                                                                                                                                                                |
| R-06              | Phạm vi WHOLE/PRODUCTS/AREA; lý do/ghi chú kiểm kê tối đa 255 ký tự.                                                                                                                                                                                                                                             |
| R-07              | Giữ menu kiểm kê; thông báo rõ chờ API BE; bỏ tổng số phiếu/phân trang giữ chỗ.                                                                                                                                                                                                                                  |
| R-08              | Không hiện hủy/xác minh/duyệt khi chưa có phiếu; không cho URL action mở các popup này khi chưa có trạng thái phù hợp. Giữ Giao việc và API warehouse-tasks như PM đã chốt; BE kiểm tra documentId và quyền.                                                                                                     |
| R-09              | Ẩn khối tổng hợp/biểu đồ lịch sử, cột tồn sau, giá vốn danh sách lô, số đã nhận của lô hết hàng khi BE không trả dữ liệu.                                                                                                                                                                                        |
| R-10              | Đã dùng /stock/summary với cùng q/categoryId/storageArea/storeId; không cộng riêng hàng đang chuyển vào withStock.                                                                                                                                                                                               |
| R-11              | Hiển thị fieldErrors chi tiết khi BE kiểm tra dữ liệu không hợp lệ.                                                                                                                                                                                                                                              |
| R-12              | Tìm tồn kho/lô dùng replace URL để không thêm mục lịch sử theo mỗi phím.                                                                                                                                                                                                                                         |
| R-13              | Đã sửa colSpan theo showBalance, test xác nhận tiêu đề ngày phủ đủ 8 hoặc 9 cột.                                                                                                                                                                                                                                 |
| R-14              | Mã gõ tay không bị ghi đè khi chọn khu vực/tầng/ô; mã cũ ngoài phạm vi chọn vẫn giữ nguyên và các ô chọn để trống.                                                                                                                                                                                               |

Bổ sung: lazy-load bốn trang inventory; màn ghi số đếm được remount theo dữ liệu phiếu để không truy cập values chưa được khởi tạo khi phiếu đến sau render đầu.

## Hợp đồng kiểm kê cần BE chốt

DTO riêng cho Staff phải loại bookQty/unitCost, không chỉ ẩn giao diện. Các trường UI cần thống nhất: code, note (theo dòng), unitCost, importedFileName, automaticallyCompleted, sourceLabel, lotCode, recountReason (cấp phiếu). Cần chốt nơi lưu giá vốn đầu kỳ, schema/DTO và nguồn tạo phiếu. File này là danh sách để review, chưa gửi tin nhắn tới người khác và chưa tự tạo endpoint/migration.

## Kiểm tra và giới hạn

Build/lint/test sau merge; smoke-test route FE-05 và FE-06, số request lô, chờ BE, tồn theo lô, mã vị trí gõ tay. Không lưu dữ liệu thử vào DB. Giao việc là thao tác ghi duy nhất đang bật trong phần kiểm kê; các API phiếu kiểm kê còn thiếu. Các thao tác tồn/vị trí/ngưỡng/hạn dùng và đọc thông báo vẫn dùng API hiện có.
