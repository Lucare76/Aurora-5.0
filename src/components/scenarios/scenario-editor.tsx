'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { FinancialScenario, ScenarioAction, ScenarioActionCode } from '@/lib/scenarios/types'
import { getActionRegistryEntry, getActionsByCategory } from '@/lib/scenarios/registry'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAction(code: ScenarioActionCode, index: number): ScenarioAction {
  return {
    id: `action-${Date.now()}-${index}`,
    code,
    enabled: true,
    label: null,
    params: {},
  }
}

// ── Code select ───────────────────────────────────────────────────────────────

function ActionCodeSelect({
  value,
  onChange,
}: {
  value: ScenarioActionCode
  onChange: (c: ScenarioActionCode) => void
}) {
  const byCategory = getActionsByCategory()
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ScenarioActionCode)}
      className="h-9 w-full rounded-lg border border-[#e5e7f0] bg-white px-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
    >
      {(Object.entries(byCategory) as [string, ScenarioActionCode[]][]).map(([cat, codes]) => (
        <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
          {codes.map((code) => {
            const e = getActionRegistryEntry(code)
            return <option key={code} value={code}>{e?.icon} {e?.label ?? code}</option>
          })}
        </optgroup>
      ))}
    </select>
  )
}

// ── Params editor — per-action field grids ────────────────────────────────────

function ParamsEditor({
  action,
  onChange,
}: {
  action: ScenarioAction
  onChange: (p: Record<string, unknown>) => void
}) {
  const p = action.params as Record<string, unknown>
  const set = (k: string, v: unknown) => onChange({ ...p, [k]: v })

  const text = (key: string, label: string, placeholder = '') => (
    <div key={key}>
      <Label className="text-xs text-slate-500">{label}</Label>
      <Input
        value={String(p[key] ?? '')}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 h-8 text-sm"
      />
    </div>
  )

  const num = (key: string, label: string, min?: number) => (
    <div key={key}>
      <Label className="text-xs text-slate-500">{label}</Label>
      <Input
        type="number"
        value={p[key] !== undefined ? String(p[key]) : ''}
        onChange={(e) => set(key, e.target.value === '' ? undefined : Number(e.target.value))}
        min={min}
        step="0.01"
        className="mt-0.5 h-8 text-sm"
      />
    </div>
  )

  const date = (key: string, label: string) => (
    <div key={key}>
      <Label className="text-xs text-slate-500">{label}</Label>
      <Input
        type="date"
        value={String(p[key] ?? '')}
        onChange={(e) => set(key, e.target.value || undefined)}
        className="mt-0.5 h-8 text-sm"
      />
    </div>
  )

  const freq = (key: string, label: string) => (
    <div key={key}>
      <Label className="text-xs text-slate-500">{label}</Label>
      <select
        value={String(p[key] ?? 'monthly')}
        onChange={(e) => set(key, e.target.value)}
        className="mt-0.5 h-8 w-full rounded-lg border border-[#e5e7f0] bg-white px-2 text-sm outline-none focus:border-indigo-400"
      >
        {['daily','weekly','biweekly','monthly','quarterly','yearly'].map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
    </div>
  )

  const grid = (children: React.ReactNode[]) => (
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>
  )

  switch (action.code) {
    case 'ONE_TIME_EXPENSE':
      return grid([num('amount','Importo (€)',0), date('date','Data'), text('description','Descrizione')])

    case 'RECURRING_EXPENSE_ADD':
    case 'RECURRING_INCOME_ADD':
      return grid([num('amount','Importo (€)',0), freq('frequency','Frequenza'), text('description','Descrizione'), date('startDate','Dal'), date('endDate','Al (opz.)')])

    case 'RECURRING_EXPENSE_UPDATE':
      return grid([text('ruleId','ID regola (UUID)'), num('newAmount','Nuovo importo (€)',0), date('startDate','Dal'), date('endDate','Al (opz.)')])

    case 'RECURRING_EXPENSE_REMOVE':
      return grid([text('ruleId','ID regola (UUID)'), date('startDate','Dal')])

    case 'RECURRING_INCOME_REDUCE':
      return grid([num('reductionAmount','Riduzione (€/mese)',0), date('startDate','Dal'), date('endDate','Al (opz.)')])

    case 'RECURRING_INCOME_PAUSE':
      return grid([date('startDate','Dal'), date('endDate','Al')])

    case 'MONTHLY_SAVINGS_CHANGE':
    case 'CATEGORY_SPENDING_CHANGE':
      return grid([num('changeAmount','Variazione (€)'), date('startDate','Dal'), date('endDate','Al (opz.)')])

    case 'GOAL_CONTRIBUTION_CHANGE':
      return grid([text('goalId','ID obiettivo (UUID)'), num('newMonthlyAmount','Nuovo importo mensile (€)',0), date('startDate','Dal'), date('endDate','Al (opz.)')])

    case 'GOAL_ONE_TIME_CONTRIBUTION':
      return grid([text('goalId','ID obiettivo (UUID)'), num('amount','Importo (€)',0), date('date','Data')])

    case 'GOAL_DEADLINE_CHANGE':
      return grid([text('goalId','ID obiettivo (UUID)'), date('newDeadline','Nuova scadenza')])

    case 'LOAN_EARLY_PAYOFF':
      return grid([text('loanId','ID prestito (UUID)'), date('payoffDate','Data saldo'), num('penaltyAmount','Penale (€, opz.)',0)])

    case 'NEW_LOAN':
      return grid([text('description','Descrizione'), num('principalAmount','Capitale (€)',0), num('downPayment','Anticipo (€, opz.)',0), num('monthlyPayment','Rata mensile (€)',0), num('numberOfPayments','N. rate',1), date('firstPaymentDate','Prima rata')])

    case 'ACCOUNT_BALANCE_ADJUSTMENT':
      return grid([num('adjustmentAmount','Rettifica (€, +/-)')])

    default:
      return <p className="mt-2 text-xs text-slate-400">Nessun parametro richiesto.</p>
  }
}

// ── Single action card ────────────────────────────────────────────────────────

function ActionCard({
  action,
  index,
  onRemove,
  onToggle,
  onChangeCode,
  onChangeParams,
  onChangeLabel,
}: {
  action: ScenarioAction
  index: number
  onRemove: () => void
  onToggle: () => void
  onChangeCode: (c: ScenarioActionCode) => void
  onChangeParams: (p: Record<string, unknown>) => void
  onChangeLabel: (l: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const entry = getActionRegistryEntry(action.code)

  return (
    <div className={cn(
      'rounded-xl border transition-colors',
      action.enabled
        ? 'border-[#e5e7f0] bg-white'
        : 'border-dashed border-slate-200 bg-slate-50/60',
    )}>
      {/* Action header */}
      <div className="flex items-center gap-2 p-3">
        {/* Index */}
        <span className="text-xs font-mono text-slate-400 w-5 shrink-0 text-center">
          {index + 1}
        </span>

        {/* Code selector — fills remaining space */}
        <div className="flex-1 min-w-0">
          <ActionCodeSelect value={action.code} onChange={onChangeCode} />
        </div>

        {/* Enabled toggle */}
        <button
          type="button"
          onClick={onToggle}
          title={action.enabled ? 'Disabilita' : 'Abilita'}
          className={cn(
            'shrink-0 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
            action.enabled
              ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
          )}
        >
          {action.enabled ? 'On' : 'Off'}
        </button>

        {/* Expand / collapse params */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          title={expanded ? 'Comprimi' : 'Espandi'}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
          title="Rimuovi"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded params */}
      {expanded && (
        <div className="px-3 pb-3">
          {/* Entry description */}
          {entry && (
            <p className="text-xs text-slate-400 mb-2 ml-7">{entry.description}</p>
          )}

          {/* Optional label */}
          <div className="ml-7 mb-2">
            <Input
              value={action.label ?? ''}
              onChange={(e) => onChangeLabel(e.target.value)}
              placeholder="Etichetta personalizzata (opzionale)"
              className="h-7 text-xs text-slate-600"
              maxLength={100}
            />
          </div>

          {/* Params */}
          <div className="ml-7">
            <ParamsEditor action={action} onChange={onChangeParams} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ScenarioEditor ───────────────────────────────────────────────────────

export function ScenarioEditor({
  scenario,
  onSave,
  onCancel,
}: {
  scenario: FinancialScenario
  onSave: (updated: FinancialScenario) => Promise<void>
  onCancel: () => void
}) {
  const [actions,     setActions]     = useState<ScenarioAction[]>(scenario.actions)
  const [name,        setName]        = useState(scenario.name)
  const [description, setDescription] = useState(scenario.description ?? '')
  const [saving,      setSaving]      = useState(false)

  const addAction = () =>
    setActions((prev) => [...prev, makeAction('ONE_TIME_EXPENSE', prev.length)])

  const remove = (id: string) =>
    setActions((prev) => prev.filter((a) => a.id !== id))

  const toggle = (id: string) =>
    setActions((prev) => prev.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a))

  const setCode = (id: string, code: ScenarioActionCode) =>
    setActions((prev) => prev.map((a) => a.id === id ? { ...a, code, params: {} } : a))

  const setParams = (id: string, params: Record<string, unknown>) =>
    setActions((prev) => prev.map((a) => a.id === id ? { ...a, params } : a))

  const setLabel = (id: string, label: string) =>
    setActions((prev) => prev.map((a) => a.id === id ? { ...a, label: label || null } : a))

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        ...scenario,
        name: name.trim() || scenario.name,
        description: description.trim() || null,
        actions,
      })
    } catch {
      toast.error('Errore durante il salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-[#e5e7f0] bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Modifica scenario</CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Name + description */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
              maxLength={100}
            />
          </div>
          <div>
            <Label>Descrizione</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              maxLength={500}
            />
          </div>
        </div>

        {/* Actions section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">
              Azioni ({actions.filter((a) => a.enabled).length}/{actions.length} attive)
            </p>
            <button
              type="button"
              onClick={addAction}
              className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Aggiungi azione
            </button>
          </div>

          {actions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
              <p className="text-sm text-slate-400">
                Nessuna azione. Aggiungi azioni per simulare variazioni al tuo flusso di cassa.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {actions.map((action, idx) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  index={idx}
                  onRemove={() => remove(action.id)}
                  onToggle={() => toggle(action.id)}
                  onChangeCode={(c) => setCode(action.id, c)}
                  onChangeParams={(p) => setParams(action.id, p)}
                  onChangeLabel={(l) => setLabel(action.id, l)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Save / Cancel */}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            Annulla
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? 'Salvataggio...' : 'Salva modifiche'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
