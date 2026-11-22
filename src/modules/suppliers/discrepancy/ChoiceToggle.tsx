import Icon from '../../../shared/ui/Icon'

/** Nhóm nút bật/tắt chọn một trong các loại (không dùng radio). Nút đang chọn có viền đậm và dấu ✓. */
export default function ChoiceToggle<T extends string>({
  label,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string
  options: { value: T; label: string; hint?: string; disabled?: boolean }[]
  value: T
  disabled: boolean
  onChange: (value: T) => void
}) {
  return (
    <div className="sd-toggle" role="group" aria-label={label}>
      {options.map((option) => {
        const on = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={'sd-toggle-option' + (on ? ' is-on' : '')}
            aria-pressed={on}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
          >
            <span className="sd-toggle-text">
              <span>{option.label}</span>
              {option.hint && <small>{option.hint}</small>}
            </span>
            {on && <Icon name="check" />}
          </button>
        )
      })}
    </div>
  )
}
