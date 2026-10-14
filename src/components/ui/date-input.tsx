'use client'

import * as React from 'react'
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dateInputError, formatItalianDate, normalizeDateDraft, parseItalianDate } from '@/lib/dates/italian'

type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'min' | 'max'> & {
  value?: string
  min?: string
  max?: string
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value = '', onChange, onBlur, className, min, max, disabled, readOnly, ...props }, forwardedRef) => {
    const [draft, setDraft] = React.useState(value ? formatItalianDate(value) : '')
    const textRef = React.useRef<HTMLInputElement>(null)
    const pickerRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
      setDraft(value ? formatItalianDate(value) : '')
      textRef.current?.setCustomValidity('')
    }, [value])

    function emit(event: React.ChangeEvent<HTMLInputElement>, iso: string) {
      const source = pickerRef.current
      if (!source) return
      source.value = iso
      onChange?.({ ...event, target: source, currentTarget: source })
    }

    return (
      <div className="relative min-w-0 rounded-lg focus-within:ring-2 focus-within:ring-indigo-200">
        <input
          {...props}
          ref={(element) => {
            textRef.current = element
            if (typeof forwardedRef === 'function') forwardedRef(element)
            else if (forwardedRef) forwardedRef.current = element
          }}
          type="text"
          inputMode="numeric"
          placeholder={props.placeholder ?? 'gg/mm/aaaa'}
          value={draft}
          disabled={disabled}
          readOnly={readOnly}
          className={cn('flex h-10 w-full rounded-lg border border-[#e5e7f0] bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:opacity-50', className, 'pr-10')}
          onChange={(event) => {
            const text = normalizeDateDraft(event.target.value)
            setDraft(text)
            const error = dateInputError(text, min, max)
            event.target.setCustomValidity(error)
            if (!text.trim()) emit(event, '')
            else {
              const iso = parseItalianDate(text)
              if (iso && !error) {
                setDraft(formatItalianDate(iso))
                emit(event, iso)
              }
            }
          }}
          onBlur={(event) => {
            const iso = parseItalianDate(draft)
            if (iso) setDraft(formatItalianDate(iso))
            onBlur?.(event)
          }}
        />
        <CalendarDays aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          ref={pickerRef}
          type="date"
          lang="it"
          aria-label="Scegli data dal calendario"
          title="Scegli data dal calendario"
          onClick={(event) => {
            try { event.currentTarget.showPicker?.() } catch { /* Native picker remains available. */ }
          }}
          value={value}
          min={min}
          max={max}
          disabled={disabled || readOnly}
          className="absolute right-0 top-0 h-full w-9 cursor-pointer opacity-0"
          onChange={(event) => {
            setDraft(event.target.value ? formatItalianDate(event.target.value) : '')
            textRef.current?.setCustomValidity('')
            onChange?.(event)
          }}
        />
      </div>
    )
  },
)
DateInput.displayName = 'DateInput'

export function FormDateInput<T extends FieldValues>({
  control, name, ...props
}: Omit<DateInputProps, 'value' | 'onChange' | 'onBlur' | 'name'> & {
  control: Control<T>
  name: FieldPath<T>
}) {
  const { field, fieldState } = useController({ control, name })
  return <DateInput {...props} ref={field.ref} name={field.name} value={String(field.value ?? '')}
    onChange={field.onChange} onBlur={field.onBlur} aria-invalid={fieldState.invalid || undefined} />
}
