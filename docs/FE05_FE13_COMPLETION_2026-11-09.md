# Kết quả rà soát FE05–FE13 trước khi push

Ngày 09/11/2026. Nhánh `feature/notifications-barcode-stock-history`, kế thừa nhánh FE09. Đối chiếu source FE với BE local; không thay đổi BE/database. Không xác nhận toàn bộ nghiệp vụ đã hoàn thành 100% hoặc đã chạy qua tài khoản thật.

| Phạm vi | Kết quả |
|---|---|
| FE05 nhập hàng/NCC | Có các luồng PO, nhận hàng, kiểm nhận, giao việc, xác nhận/kiểm lại, hàng thừa và sai lệch NCC; bổ sung lọc danh sách sai lệch và quét mã. |
| FE06 tồn kho/lô | Có danh sách/chi tiết tồn, vị trí/ngưỡng, lịch sử, lô/hạn dùng; liên kết chứng từ theo quyền. |
| FE07 đơn bán | Có danh sách/phân trang/lọc BE, tạo/sửa, lấy hàng/giao việc, thanh toán/hoàn tiền, hoàn tất/hủy; quét barcode chính xác rồi lấy giá. |
| FE08 công nợ | Có danh sách/chi tiết, mua chịu, nợ đầu kỳ, phân bổ/ghi thu và chứng từ. Các ô tổng hợp toàn chuỗi chưa có API tổng hợp, còn hiển thị —. |
| FE09 điều chuyển | Có yêu cầu bổ sung, điều phối/tạo lệnh, soạn/xuất, nhận/kiểm lại/xác nhận, xuất thừa, sai lệch/trả nguồn và đóng phiếu. Đã xử lý phần FE review PR29; các giới hạn BE ghi bên dưới. |
| FE10 kiểm kê/điều chỉnh | Kiểm kê CYCLE/YEAR_END và yêu cầu Owner đã nối từ danh sách đến đếm, xác minh, đếm lại, duyệt/hủy và giao người đếm. Điều chỉnh độc lập, nhập tồn đầu kỳ OPENING chưa đủ API. |
| FE11 tổng quan/thông báo/giao việc | Nối dữ liệu chứng từ/cảnh báo hiện có, thông báo/đánh dấu đọc và popup giao việc dùng chung. Báo cáo tài chính/tổng doanh số chưa có API tương ứng. |
| FE12 quét mã | Có tra barcode chính xác, nhập mã/máy quét Enter và camera khi trình duyệt hỗ trợ. Chưa kiểm tra camera/máy quét vật lý. |
| FE13 tồn quá khứ/kỳ kho | Có tra tồn ngày với kho, nhóm, tìm kiếm, tồn 0 và phân trang. Quản lý kỳ kho và JOB04 snapshot chưa có hỗ trợ BE. |

## Các phần chưa thể đánh dấu hoàn tất

- API nhận diện BM kho tổng/danh mục kho chưa đầy đủ; FE không tự nâng quyền BM chi nhánh.
- Trả lời đề xuất cung cấp một phần theo mockup, liên kết PO với yêu cầu bổ sung và lưu lý do điều chuyển cần BE bổ sung hợp đồng.
- API danh sách chưa hỗ trợ lọc nhiều trạng thái/open cùng phân trang; các adapter FE vẫn cần tải nhiều trang.
- DTO kiểm kê Staff chưa có trạng thái task đầy đủ khi tải lại; BE vẫn quyết định quyền ghi, FE khóa khi bị từ chối.
- Thông báo nhận điều chuyển thiếu mã lệnh cha; có đường dẫn dự phòng về danh sách, chưa mở thẳng được mọi phiếu.
- Tổng hợp công nợ/doanh số/so sánh cửa hàng/báo cáo, quản lý kỳ kho, điều chỉnh độc lập và snapshot cuối ngày còn phụ thuộc BE.

## Kiểm tra thực hiện

- `npm test`: 68/68 đạt.
- `npm run build`: đạt.
- `npm run lint`: 0 lỗi, 13 cảnh báo còn tồn tại.
- Kiểm tra trình duyệt với API mô phỏng: Staff bắt đầu/lưu số 0/gửi kiểm kê, BM xác minh, tạo từ yêu cầu, Owner duyệt và tạo/hủy yêu cầu, trả đếm lại, khóa khi trạng thái thay đổi. Không có lỗi JavaScript.
- Kiểm tra 7 màn tổng quan/công nợ/yêu cầu bổ sung/điều chuyển/tồn ngày/đơn bán/kiểm kê ở desktop và mobile: không tràn chiều ngang toàn trang, không có lỗi JavaScript.
- Không ghi dữ liệu thật; chưa thay thế kiểm thử tích hợp đầy đủ với BE và thiết bị thực tế.

Chi tiết đối chiếu API: `FE05_FE13_API_AUDIT_2026-11-09.md`. Chi tiết sửa review: `PR29_FE_FIXES_2026-11-09.md`. Các mục A–D trong báo cáo API là ghi nhận ban đầu, đã được xử lý như phần cập nhật đầu tài liệu.
