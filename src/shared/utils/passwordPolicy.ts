/**
 * File: shared/utils/passwordPolicy.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Hàm kiểm tra mật khẩu; trả danh sách điều kiện, isValid và thông báo lỗi.
 */
export type PasswordRequirement = {
  label: string
  met: boolean
}

export type PasswordValidation = {
  requirements: PasswordRequirement[]
  isValid: boolean
  error: string
}

/** validateNewPassword: Kiểm tra các điều kiện mật khẩu và trả danh sách yêu cầu, trạng thái hợp lệ cùng thông báo lỗi. */
export function validateNewPassword(
  password: string,
  temporaryPassword: string,
  username: string,
): PasswordValidation {
  const requirements: PasswordRequirement[] = [
    {
      label: 'Từ 8 đến 50 ký tự',
      met: password.length >= 8 && password.length <= 50,
    },
    {
      label: 'Có ít nhất 1 chữ cái',
      met: /\p{L}/u.test(password),
    },
    { label: 'Có ít nhất 1 chữ số', met: /\p{Nd}/u.test(password) },
    {
      label: 'Có ít nhất 1 ký tự đặc biệt',
      met: /[^\p{L}\p{N}\s]/u.test(password),
    },
    {
      label: 'Khác mật khẩu hiện tại',
      met: password.length > 0 && password !== temporaryPassword,
    },
  ]
  const differsFromUsername =
    password.length > 0 && password.toLowerCase() !== username.toLowerCase()
  const fitsPasswordHash = new TextEncoder().encode(password).length <= 72

  let error = ''
  if (!differsFromUsername)
    error = 'Mật khẩu mới không được trùng tên đăng nhập.'
  else if (!fitsPasswordHash)
    error = 'Mật khẩu mới quá dài. Vui lòng dùng mật khẩu ngắn hơn.'
  else if (!requirements.every((requirement) => requirement.met))
    error = 'Vui lòng hoàn thành các yêu cầu của mật khẩu mới.'

  return {
    requirements,
    isValid: error.length === 0,
    error,
  }
}
