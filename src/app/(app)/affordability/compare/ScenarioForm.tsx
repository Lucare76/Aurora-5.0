'use client'

import { DOMAIN_FIELDS, isFieldRequired, type ScenarioDraft } from './types'

export default function ScenarioForm({
  draft,
  onChange,
}: {
  draft: ScenarioDraft
  onChange: (next: ScenarioDraft) => void
}) {
  function setField(key: string, value: string) {
    onChange({ ...draft, fields: { ...draft.fields, [key]: value } })
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${draft.id}-label`} className="block text-xs font-medium text-slate-500">
          Etichetta scenario (opzionale)
        </label>
        <input
          id={`${draft.id}-label`}
          type="text"
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          placeholder="es. Opzione A"
          maxLength={120}
          className="mt-1 block w-full rounded-lg border border-[#e5e7f0] bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DOMAIN_FIELDS[draft.domain].map((field) => {
          const inputId = `${draft.id}-${field.key}`
          const required = isFieldRequired(field, draft.fields)
          return (
            <div key={field.key}>
              <label htmlFor={inputId} className="block text-xs font-medium text-slate-500">
                {field.label}
                {required && <span aria-hidden="true"> *</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  id={inputId}
                  value={draft.fields[field.key] ?? ''}
                  onChange={(e) => setField(field.key, e.target.value)}
                  required={required}
                  className="mt-1 block w-full rounded-lg border border-[#e5e7f0] bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Seleziona…</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={inputId}
                  type={field.type}
                  value={draft.fields[field.key] ?? ''}
                  onChange={(e) => setField(field.key, e.target.value)}
                  required={required}
                  min={field.min}
                  step={field.step}
                  className="mt-1 block w-full rounded-lg border border-[#e5e7f0] bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
