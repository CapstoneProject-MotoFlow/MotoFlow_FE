export type PasswordRequirement = {
  label: string
  met: boolean
}

export type PasswordValidation = {
  requirements: PasswordRequirement[]
  isValid: boolean
  error: string
}

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
      label: 'Có chữ hoa và chữ thường',
      met: /\p{Lu}/u.test(password) && /\p{Ll}/u.test(password),
    },
    { label: 'Có ít nhất 1 chữ số', met: /\p{Nd}/u.test(password) },
    {
      label: 'Có ít nhất 1 ký tự đặc biệt',
      met: /[^\p{L}\p{N}\s]/u.test(password),
    },
    {
      label: 'Khác mật khẩu tạm',
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
