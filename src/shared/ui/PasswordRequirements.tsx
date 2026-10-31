/**
 * File: shared/ui/PasswordRequirements.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Hiển thị các điều kiện mật khẩu và trạng thái đã đạt/chưa đạt.
 */
import type { ReactNode } from 'react'
import { validateNewPassword } from '../utils/passwordPolicy'

type PasswordRequirementsProps = {
  password: string
  temporaryPassword: string
  username: string
  differentFromLabel?: string
}

/** PasswordRequirements: Hiển thị các điều kiện mật khẩu và trạng thái đã đạt/chưa đạt. */
export default function PasswordRequirements({
  password,
  temporaryPassword,
  username,
  differentFromLabel = 'Khác mật khẩu hiện tại',
}: PasswordRequirementsProps) {
  const { requirements } = validateNewPassword(
    password,
    temporaryPassword,
    username,
  )

  return (
    <ul className="password-rules" aria-label="Yêu cầu mật khẩu mới">
      {requirements.map((requirement) => (
        <Requirement key={requirement.label} met={requirement.met}>
          {requirement.label === 'Khác mật khẩu hiện tại'
            ? differentFromLabel
            : requirement.label}
        </Requirement>
      ))}
    </ul>
  )
}

function Requirement({ met, children }: { met: boolean; children: ReactNode }) {
  return (
    <li className={met ? 'password-rule is-met' : 'password-rule'}>
      <span aria-hidden="true">{met ? '✓' : '○'}</span>
      {children}
    </li>
  )
}
