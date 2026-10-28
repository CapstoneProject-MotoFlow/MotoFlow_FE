import type { ReactNode } from 'react'
import { validateNewPassword } from './passwordPolicy'

type PasswordRequirementsProps = {
  password: string
  temporaryPassword: string
  username: string
  differentFromLabel?: string
}

export default function PasswordRequirements({ password, temporaryPassword, username, differentFromLabel = 'Khác mật khẩu tạm' }: PasswordRequirementsProps) {
  const { requirements } = validateNewPassword(password, temporaryPassword, username)

  return (
    <ul className="password-rules" aria-label="Yêu cầu mật khẩu mới">
      {requirements.map((requirement) => (
        <Requirement key={requirement.label} met={requirement.met}>{requirement.label === 'Khác mật khẩu tạm' ? differentFromLabel : requirement.label}</Requirement>
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
