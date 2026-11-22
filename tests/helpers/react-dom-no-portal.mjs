// Chỉ dùng trong test SSR: server renderer không hỗ trợ portal, nên createPortal trả về nội dung tại chỗ.
export const createPortal = (node) => node
