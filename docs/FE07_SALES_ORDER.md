# Đối chiếu BE mới — 08/11/2026

Đã fetch và đọc origin/main BE e795f95 tại artifacts/be-latest-review. Nhận định chưa có API ở phần ghi chép cũ bên dưới không còn đúng.

Đã sửa FE: trạng thái AWAITING_PICKING, adapter DTO thật, quyền actions từ BE, giới hạn số lượng 100.000; danh sách gọi GET /sales-orders bằng view/q/createdFrom/createdTo/page/size; chi tiết và lấy hàng gọi GET /sales-orders/:id; nhu cầu gọi GET /unmet-demand và phân trang, bỏ giả định có API ghi nhu cầu thủ công. BE tự tính nhu cầu từ đơn hoàn tất giao thiếu và đơn hủy.

Còn phải nối tiếp: POST preview/create, PUT update/picked-lines, POST confirm, lịch sử phiên bản và các thao tác settlement. Những nút này hiện vẫn khóa; không được coi FE-07 đã hoàn tất chỉ vì API đã có. Cần cập nhật quyền Owner tạo/sửa, quyền BM được giao nhặt hàng theo actions; cần dùng total/actualUnitPrice/money từ BE khi hiển thị và gửi expectedPayable/version đúng hợp đồng trước khi mở nút thanh toán.

FE-06: bản BE này vẫn không có tham số lotId trong danh sách lô, không trả giá trong LotRowResponse và chưa có API kiểm kê. Không bỏ các cách xử lý tạm của FE-06.

## Ghi chép trước khi fetch BE

# FE-07 — Sales Order Management

Nhánh: feature/FE-07-sales-order-management, tạo từ FE-06 commit 2a96298 vì origin/main chưa có FE-06. Khi mở PR cần tính phần phụ thuộc này, không coi các thay đổi FE-06 là thay đổi mới của FE-07.

Nguồn: MotoFlow_UI_ToanBo.html cùng screens_sales.js và iteration3.js của bộ mockup ba iteration do người dùng cung cấp. Ảnh phân công gồm UC-52 đến UC-61. Không đưa các đơn hàng mẫu của mockup vào ứng dụng.

## Màn và quyền

| Màn                  | Route                  | Quyền          | Đã dựng                                                                                                                           |
| -------------------- | ---------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Danh sách đơn bán    | /sales-orders          | Owner/BM/Staff | Bộ lọc, tab theo vai trò; Owner lọc cửa hàng, Staff chỉ giao diện công việc lấy hàng, không có cột tiền                           |
| Tạo đơn              | /sales-orders/new      | BM             | Khách hàng/khách lẻ, tạo nhanh khách, phụ tùng, máy quét mã vạch dạng bàn phím, số lượng, bán lẻ/buôn, chiết khấu chung, tạm tính |
| Sửa đơn              | /sales-orders/:id/edit | BM             | Chặn sửa khi chưa tải được đơn; SalesOrderFormView có thể nhận dữ liệu đơn để sửa dòng và tạo phiên bản mới khi có API            |
| Chi tiết             | /sales-orders/:id      | Owner/BM/Staff | Dòng yêu cầu/nhặt/giao; tiền và công nợ chỉ Owner/BM; lịch sử; thao tác theo trạng thái                                           |
| Xác nhận             | Popup chi tiết         | BM             | Nhập số giao giới hạn bởi số nhặt/yêu cầu, cam kết khách đồng ý, cảnh báo kiểm tra giá/tồn/hạn dùng                               |
| Ghi số nhặt          | /sales-orders/:id/pick | Staff          | Theo vị trí/lô ưu tiên, số nhặt, đánh dấu thiếu, nhập SKU từ máy quét; không có tiền/giá vốn                                      |
| Nhu cầu chưa đáp ứng | /unmet-demand          | Owner/BM       | Bộ lọc cửa hàng/tìm kiếm/trạng thái, bảng và popup ghi phần thiếu trên đơn                                                        |

## Kết nối thật

- GET /customers, GET /products và GET /products/:id dùng tìm và kiểm tra chính xác mã vạch. Không tự nhận kết quả tìm gần đúng là mã vạch đúng.
- Popup tạo nhanh dùng CustomerForm và POST /customers hiện có; đây là thao tác ghi dữ liệu thật.
- Giao việc dùng GET/POST /warehouse-tasks với taskType=PICKING; kiểm tra canAssign, documentId, người đủ điều kiện, chống gửi lặp và hiển thị lịch sử/lỗi từ BE. Có thể mở /sales-orders/:id?action=assign bằng BM; BE xác thực phiếu và kho.
- Thông báo SALES_ORDER mở route đơn bán FE-07.

## Chưa hoàn tất vì chưa có API

BE trong workspace mới có entity/repository đơn bán và API giao việc chung; chưa thấy controller/service/DTO phục vụ danh sách, đọc đơn theo phiên bản, tạo/sửa đơn, ghi số nhặt, xác nhận, thanh toán, bán chịu và nhu cầu chưa đáp ứng. Không tự đặt endpoint. Các model salesModel.ts là model hiển thị FE, không phải hợp đồng API BE.

Các màn danh sách/chi tiết chưa tải được dữ liệu nghiệp vụ thật; không thể xác nhận phân trang hoặc phạm vi bản ghi ở server. Nút lưu/tạo/gửi/xác nhận/thu tiền/bán chịu/hủy vẫn khóa. Không tự trừ tồn, ghi doanh thu, giá vốn hay công nợ trong FE.

Chưa có camera quét mã hoặc luồng nhận dữ liệu phiếu điều chuyển. Bộ nhận số nhặt đã tách view nhưng cần hợp đồng dữ liệu và quyền của luồng điều chuyển khi được triển khai. Ngưỡng chiết khấu và biên lợi nhuận không dùng hằng số từ dữ liệu mẫu; sẽ do BE kiểm tra khi có API.

## Kiểm tra

Build TypeScript/Vite, ESLint và các test tính giá theo đơn vị trước khi nhân số lượng, điều kiện hủy, thiếu hàng và HTML theo vai trò. Chưa xác nhận khớp từng pixel hay kiểm thử lưu đơn end-to-end.
