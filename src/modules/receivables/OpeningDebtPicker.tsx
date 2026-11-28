import './receivables.css'
import LocalizedFileInput from '../../shared/ui/LocalizedFileInput'
import { useRef, useState } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import axiosClient from '../../shared/api/axiosClient'
import { uploadAttachment } from '../../shared/api/upload'
import { useInventoryScope, inventoryError } from '../inventory/api'
import { useChoicePages } from '../sales/useSalesList'
import { money, today } from '../inventory/presentation'
import type { Customer } from '../customers/types'
import { useFormValidation } from '../../shared/hooks/useFormValidation'
import FieldError from '../../shared/ui/FieldError'
export default function OpeningDebtPicker({
  onClose,
  onSaved,
  initialCustomer,
}: {
  onClose: () => void
  onSaved: () => void
  initialCustomer?: { customerId: number; customerName: string; phone: string }
}) {
  const scope = useInventoryScope(),
    [query, setQuery] = useState(''),
    [customer, setCustomer] = useState(
      initialCustomer
        ? {
            id: initialCustomer.customerId,
            customerName: initialCustomer.customerName,
            phone: initialCustomer.phone,
          }
        : undefined,
    ),
    [amount, setAmount] = useState(''),
    [due, setDue] = useState(''),
    [note, setNote] = useState(''),
    [files, setFiles] = useState<File[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [showChoices, setShowChoices] = useState(false)
  const validation = useFormValidation()
  const choices = useChoicePages<Customer>('/customers', query),
    lock = useRef(false)
  const warehouse = scope.storeId
    ? scope.stores.find((store) => String(store.id) === scope.storeId)
    : scope.stores.find((store) => store.central)
  const [selectedStoreId, setSelectedStoreId] = useState(
    () => scope.storeId ?? '',
  )
  const resolvedStoreId =
    selectedStoreId ||
    (warehouse ? String(warehouse.id) : scope.stores[0] ? String(scope.stores[0].id) : '')
  const activeStore = scope.stores.find(
    (store) => String(store.id) === resolvedStoreId,
  )
  const late = due && due < today(),
    valid =
      customer &&
      !!resolvedStoreId &&
      Number.isSafeInteger(Number(amount)) &&
      Number(amount) > 0 &&
      Number(amount) <= 100000000000 &&
      due &&
      files.length > 0 &&
      note.trim().length > 0
  async function save() {
    if (lock.current) return
    if (!customer) {
      setError('Vui lòng chọn khách hàng.')
      return
    }
    if (!resolvedStoreId) {
      setError('Vui lòng chọn cửa hàng ghi nợ.')
      return
    }
    if (!files.length) {
      setError('Vui lòng đính kèm ít nhất 1 tệp chứng từ.')
      return
    }
    if (!note.trim()) {
      setError('Vui lòng nhập ghi chú cho khoản nợ đầu kỳ.')
      return
    }
    if (!valid) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const evidence = []
      for (const file of files) evidence.push(await uploadAttachment(file))
      await axiosClient.post(`/customers/${customer.id}/opening-debts`, {
        storeId: Number(resolvedStoreId),
        amount: Number(amount),
        dueDate: due,
        note: note.trim(),
        evidence,
      })
      onSaved()
    } catch (e) {
      setError(inventoryError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <FormDialog
      title="Ghi nợ đầu kỳ"
      formId="opening-debt"
      className="rv-opening-dialog"
      submitLabel="Ghi nợ đầu kỳ"
      submitDisabled={!valid}
      busy={busy}
      onClose={onClose}
    >
      <form
        id="opening-debt"
        className="rv-opening-form"
        noValidate
        onInput={validation.onInput}
        onSubmit={(e) => {
          e.preventDefault()
          if (!validation.check(e.currentTarget)) return
          void save()
        }}
      >
        {error && (
          <p role="alert" className="stock-error">
            {error}
          </p>
        )}
        <fieldset disabled={busy}>
          <label className="rv-full">
            Khách hàng <span>*</span>
            <input
              name="customer"
              data-required-message="Vui lòng chọn khách hàng"
              role="combobox"
              aria-expanded={showChoices && !customer}
              aria-controls="opening-customers"
              onFocus={() => setShowChoices(true)}
              value={
                customer
                  ? `${customer.customerName} · ${customer.phone ?? ''}`
                  : query
              }
              placeholder="Tìm tên hoặc số điện thoại"
              onChange={(e) => {
                setCustomer(undefined)
                setQuery(e.target.value)
              }}
              required
            />
            {!customer && showChoices && (
              <div
                className="rv-opening-choices"
                id="opening-customers"
                role="listbox"
              >
                {choices.data?.items.map((c) => (
                  <button
                    role="option"
                    aria-selected={false}
                    type="button"
                    key={c.id}
                    onClick={() => {
                      setCustomer({
                        id: c.id,
                        customerName: c.customerName,
                        phone: c.phone ?? '',
                      })
                      setQuery('')
                    }}
                  >
                    {c.customerName} · {c.phone}
                  </button>
                ))}
                {choices.loading && <small>Đang tìm khách…</small>}
                {choices.error && <p role="alert">{choices.error}</p>}
                {choices.hasMore && (
                  <button type="button" onClick={choices.loadMore}>
                    Xem thêm
                  </button>
                )}
              </div>
            )}
            <FieldError message={validation.errors.customer} />
          </label>
          <label className="rv-full">
            Cửa hàng ghi nợ <span>*</span>
            <select
              name="storeId"
              required
              disabled={busy}
              value={resolvedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
            >
              {!resolvedStoreId && <option value="">Chọn cửa hàng</option>}
              {scope.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.storeName}
                </option>
              ))}
            </select>
            <FieldError message={validation.errors.storeId} />
          </label>
          <label>
            Số tiền nợ <span>*</span>
            <div className="rv-money-input">
              <input
                name="amount"
                data-label="Số tiền nợ"
                inputMode="numeric"
                value={amount ? Number(amount).toLocaleString('vi-VN') : ''}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                required
              />
              <span>đ</span>
            </div>
            <FieldError message={validation.errors.amount} />
          </label>
          <label>
            Hạn trả <span>*</span>
            <input
              name="dueDate"
              type="date"
              required
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
            <FieldError message={validation.errors.dueDate} />
            {late && (
              <small className="rv-warning">
                Đã quá hạn: khoản nợ sẽ hiện là quá hạn.
              </small>
            )}
          </label>
          <div className="rv-full rv-evidence">
            <label htmlFor="opening-files">
              Chứng cứ <span>*</span>
            </label>
            {files.map((file, index) => (
              <div className="rv-file" key={index}>
                <span className="rv-file-icon">▧</span>
                <div>
                  <strong>Tệp {index + 1}</strong>
                  <small>{Math.ceil(file.size / 1024)} KB</small>
                </div>
                <button
                  type="button"
                  aria-label={'Bỏ tệp ' + (index + 1)}
                  onClick={() => setFiles(files.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
            <LocalizedFileInput
              id="opening-files"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const next = Array.from(e.target.files ?? [])
                if (next.length + files.length > 10) {
                  setError('Tối đa 10 chứng từ.')
                  return
                }
                setFiles([...files, ...next])
                e.target.value = ''
              }}
            />
            <small>JPG, PNG, WebP hoặc PDF, tối đa 10 MB/tệp.</small>
          </div>
          <label className="rv-full">
            Ghi chú <span>*</span>
            <textarea
              name="note"
              required
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Diễn giải khoản nợ và nguồn chứng từ"
            />
            <FieldError message={validation.errors.note} />
          </label>
          {customer && amount && (
            <p className="rv-opening-recap rv-full">
              Sẽ ghi nợ đầu kỳ <strong>{money.format(Number(amount))}</strong>{' '}
              cho {customer.customerName}
              {activeStore && ' tại ' + activeStore.storeName}
              {due && (
                <>
                  , hạn trả{' '}
                  <strong>{due.split('-').reverse().join('/')}</strong>
                  {late ? ' (đã quá hạn)' : ''}
                </>
              )}
              . Không ghi doanh thu, không đổi tồn kho.
            </p>
          )}
        </fieldset>
      </form>
    </FormDialog>
  )
}
