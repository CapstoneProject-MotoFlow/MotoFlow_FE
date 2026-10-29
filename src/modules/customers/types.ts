export type Customer = {
  id: number; customerName: string; phone: string | null; address: string | null;
  taxCode: string | null; creditStatus: string; createdAt: string; updatedAt: string;
}
export type CustomerFormValues = {
  customerName: string; phone: string; contactName: string; address: string; taxCode: string; notes: string;
}
export const customerApiMessage = 'Chức năng khách hàng chưa được kết nối API. Chưa thể tải hoặc lưu dữ liệu khách hàng.'
