'use client'

import { useEffect, useMemo, useState } from 'react'
import { Archive, Copy, FlaskConical, History, Loader2, Play, Plus, RefreshCcw, Sparkles, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { cn, formatCurrency } from '@/lib/utils'
import type { AutomationApplication, AutomationPreviewRow, AutomationRule } from '@/lib/automation/types'

type RuleForm = {
  id?: string
  name: string
  description: string
  is_active: boolean
  priority: number
  match_mode: 'ALL' | 'ANY'
  stop_processing: boolean
  apply_to_new_transactions: boolean
  archived: boolean
  description_operator: 'CONTAINS' | 'EQUALS' | 'STARTS_WITH' | 'ENDS_WITH' | 'NOT_CONTAINS'
  description_value: string
  transaction_type: 'any' | 'income' | 'expense' | 'transfer'
  category_id: string
  account_id: string
  normalize_description: string
  append_note: string
}

const emptyForm: RuleForm = {
  name: '',
  description: '',
  is_active: true,
  priority: 100,
  match_mode: 'ALL',
  stop_processing: true,
  apply_to_new_transactions: false,
  archived: false,
  description_operator: 'CONTAINS',
  description_value: '',
  transaction_type: 'any',
  category_id: '',
  account_id: '',
  normalize_description: '',
  append_note: '',
}

function toPayload(form: RuleForm) {
  const conditions = [
    form.description_value.trim() ? { type: 'description', operator: form.description_operator, value: form.description_value.trim() } : null,
    form.transaction_type !== 'any' ? { type: 'transaction_type', value: form.transaction_type } : null,
  ].filter(Boolean)

  const actions = [
    form.category_id ? { type: 'set_category', category_id: form.category_id } : null,
    form.account_id ? { type: 'set_account', account_id: form.account_id } : null,
    form.normalize_description.trim() ? { type: 'normalize_description', description: form.normalize_description.trim() } : null,
    form.append_note.trim() ? { type: 'append_note', note: form.append_note.trim() } : null,
  ].filter(Boolean)

  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    is_active: form.is_active,
    priority: Number(form.priority),
    match_mode: form.match_mode,
    stop_processing: form.stop_processing,
    apply_to_new_transactions: form.apply_to_new_transactions,
    archived: form.archived,
    conditions,
    actions,
  }
}

function fromRule(rule: AutomationRule): RuleForm {
  const description = rule.conditions.find((condition) => condition.type === 'description')
  const transactionType = rule.conditions.find((condition) => condition.type === 'transaction_type')
  const category = rule.actions.find((action) => action.type === 'set_category')
  const account = rule.actions.find((action) => action.type === 'set_account')
  const normalized = rule.actions.find((action) => action.type === 'normalize_description')
  const note = rule.actions.find((action) => action.type === 'append_note')
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description ?? '',
    is_active: rule.is_active,
    priority: rule.priority,
    match_mode: rule.match_mode,
    stop_processing: rule.stop_processing,
    apply_to_new_transactions: rule.apply_to_new_transactions,
    archived: rule.archived,
    description_operator: description?.type === 'description' ? description.operator : 'CONTAINS',
    description_value: description?.type === 'description' ? description.value : '',
    transaction_type: transactionType?.type === 'transaction_type' ? transactionType.value : 'any',
    category_id: category?.type === 'set_category' && category.category_id ? category.category_id : '',
    account_id: account?.type === 'set_account' ? account.account_id : '',
    normalize_description: normalized?.type === 'normalize_description' ? normalized.description : '',
    append_note: note?.type === 'append_note' ? note.note : '',
  }
}

function describeRule(rule: AutomationRule, categoryName: (id: string | null) => string, accountName: (id: string) => string) {
  const when = rule.conditions.map((condition) => {
    if (condition.type === 'description') return `descrizione ${condition.operator.toLowerCase()} "${condition.value}"`
    if (condition.type === 'transaction_type') return `tipo ${condition.value}`
    if (condition.type === 'amount') return 'importo'
    if (condition.type === 'account') return 'conto'
    if (condition.type === 'category') return 'categoria'
    return 'data'
  }).join(rule.match_mode === 'ALL' ? ' e ' : ' oppure ')
  const then = rule.actions.map((action) => {
    if (action.type === 'set_category') return `categoria ${categoryName(action.category_id)}`
    if (action.type === 'set_account') return `conto ${accountName(action.account_id)}`
    if (action.type === 'normalize_description') return `descrizione "${action.description}"`
    if (action.type === 'append_note') return 'nota aggiunta'
    return `tipo ${action.transaction_type}`
  }).join(', ')
  return `Quando ${when}, applica ${then}.`
}

export default function AutomationPage() {
  const { accounts } = useAccounts()
  const { categories } = useCategories()
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [applications, setApplications] = useState<AutomationApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<RuleForm>(emptyForm)
  const [preview, setPreview] = useState<AutomationPreviewRow[]>([])
  const [testResult, setTestResult] = useState<string | null>(null)

  const categoryName = (id: string | null) => id ? categories.find((category) => category.id === id)?.name ?? 'Categoria non disponibile' : 'Nessuna categoria'
  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name ?? 'Conto non disponibile'

  const stats = useMemo(() => ({
    active: rules.filter((rule) => rule.is_active && !rule.archived).length,
    inactive: rules.filter((rule) => !rule.is_active && !rule.archived).length,
    archived: rules.filter((rule) => rule.archived).length,
    applied: applications.filter((item) => item.result === 'APPLIED').length,
    conflicts: applications.filter((item) => item.result === 'CONFLICT').length,
    errors: applications.filter((item) => item.result === 'FAILED').length,
  }), [applications, rules])

  async function load() {
    setLoading(true)
    try {
      const response = await fetch('/api/automation/rules', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'AUTOMATION_FAILED')
      setRules(body.rules ?? [])
      setApplications(body.applications ?? [])
    } catch {
      toast.error('Automazioni non disponibili')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function startCreate() {
    setForm(emptyForm)
    setPreview([])
    setTestResult(null)
    setFormOpen(true)
  }

  function startEdit(rule: AutomationRule) {
    setForm(fromRule(rule))
    setPreview([])
    setTestResult(null)
    setFormOpen(true)
  }

  async function saveRule() {
    const payload = toPayload(form)
    if (!payload.name || payload.conditions.length === 0 || payload.actions.length === 0) {
      toast.error('Inserisci almeno nome, condizione e azione')
      return
    }
    setSaving(true)
    try {
      const response = await fetch(form.id ? `/api/automation/rules/${form.id}` : '/api/automation/rules', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'INVALID_RULE')
      toast.success(form.id ? 'Regola aggiornata' : 'Regola creata')
      setFormOpen(false)
      await load()
    } catch {
      toast.error('Regola non valida')
    } finally {
      setSaving(false)
    }
  }

  async function patchRule(rule: AutomationRule, patch: Partial<RuleForm>) {
    const payload = toPayload({ ...fromRule(rule), ...patch })
    const response = await fetch(`/api/automation/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error('PATCH_FAILED')
    await load()
  }

  async function duplicateRule(rule: AutomationRule) {
    const payload = toPayload({ ...fromRule(rule), id: undefined, name: `${rule.name} copia`, priority: rule.priority + 1 })
    const response = await fetch('/api/automation/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error('DUPLICATE_FAILED')
    toast.success('Regola duplicata')
    await load()
  }

  async function deleteRule(rule: AutomationRule) {
    if (!window.confirm(`Eliminare definitivamente "${rule.name}"?`)) return
    const response = await fetch(`/api/automation/rules/${rule.id}`, { method: 'DELETE' })
    if (!response.ok) {
      toast.error('Eliminazione non riuscita')
      return
    }
    toast.success('Regola eliminata')
    await load()
  }

  async function previewRule(ruleId = form.id) {
    if (!ruleId) return
    const response = await fetch(`/api/automation/rules/${ruleId}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 20 }),
    })
    const body = await response.json()
    if (!response.ok) {
      toast.error('Anteprima non disponibile')
      return
    }
    setPreview(body.rows ?? [])
    toast.info('Questa è soltanto un’anteprima')
  }

  async function testRule(ruleId = form.id) {
    if (!ruleId) {
      toast.error('Salva la regola prima di provarla')
      return
    }
    const response = await fetch(`/api/automation/rules/${ruleId}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: form.description_value || 'NETFLIX',
        amount: 12.99,
        type: form.transaction_type === 'any' ? 'expense' : form.transaction_type,
        account_id: accounts[0]?.id,
        category_id: null,
        date: new Date().toLocaleDateString('en-CA'),
      }),
    })
    const body = await response.json()
    if (!response.ok) {
      toast.error('Test non disponibile')
      return
    }
    setTestResult(body.evaluation?.matched ? 'La regola corrisponde al movimento di prova.' : 'La regola non corrisponde al movimento di prova.')
  }

  async function applyBulk(rule: AutomationRule) {
    if (!window.confirm(`Applicare "${rule.name}" ai movimenti degli ultimi 90 giorni?`)) return
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - 90)
    const response = await fetch(`/api/automation/rules/${rule.id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: from.toLocaleDateString('en-CA'), to: to.toLocaleDateString('en-CA'), confirm: true, limit: 500 }),
    })
    const body = await response.json()
    if (!response.ok) {
      toast.error(body.error === 'APPLY_LIMIT_EXCEEDED' ? 'Troppi movimenti: restringi l’intervallo' : 'Applicazione non riuscita')
      return
    }
    toast.success(`Batch completato: ${body.batch.applied_count} applicati`)
    await load()
  }

  async function revertBatch(batchId: string) {
    if (!window.confirm('Annullare questa applicazione massiva?')) return
    const response = await fetch(`/api/automation/batches/${batchId}/revert`, { method: 'POST' })
    const body = await response.json()
    if (!response.ok) {
      toast.error('Annullamento non riuscito')
      return
    }
    toast.success(body.batch.status === 'REVERT_CONFLICT' ? 'Annullamento con conflitti' : 'Applicazione annullata')
    await load()
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-indigo-600">Regole deterministiche</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Automazioni</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">Classifica movimenti con regole spiegabili, ordinate per priorità e sempre verificabili prima dell’applicazione massiva.</p>
        </div>
        <Button className="gap-2" onClick={startCreate}><Plus className="h-4 w-4" />Nuova regola</Button>
      </header>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Attive" value={stats.active} />
        <Metric label="Disattivate" value={stats.inactive} />
        <Metric label="Archiviate" value={stats.archived} />
        <Metric label="Applicate" value={stats.applied} tone="green" />
        <Metric label="Conflitti" value={stats.conflicts} tone="amber" />
        <Metric label="Errori" value={stats.errors} tone="red" />
      </section>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-3xl" />)}</div>
      ) : rules.length === 0 ? (
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardContent className="p-10 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-indigo-500" />
            <h2 className="mt-4 text-xl font-bold text-slate-950">Non hai ancora creato automazioni</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Crea una regola per classificare più velocemente i tuoi movimenti senza usare AI o servizi esterni.</p>
            <Button className="mt-6 gap-2" onClick={startCreate}><Plus className="h-4 w-4" />Crea la prima regola</Button>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {rules.map((rule) => (
            <Card key={rule.id} className={cn('border-[#e5e7f0] bg-white shadow-sm', rule.archived && 'opacity-70')}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                    <p className="mt-2 text-sm text-slate-500">{describeRule(rule, categoryName, accountName)}</p>
                  </div>
                  <span className={cn('rounded-full px-3 py-1 text-xs font-bold', rule.archived ? 'bg-slate-100 text-slate-500' : rule.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                    {rule.archived ? 'Archiviata' : rule.is_active ? 'Attiva' : 'Disattivata'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <Info label="Priorità" value={String(rule.priority)} />
                  <Info label="Match" value={rule.match_mode} />
                  <Info label="Auto" value={rule.apply_to_new_transactions ? 'Sì' : 'No'} />
                  <Info label="Stop" value={rule.stop_processing ? 'Sì' : 'No'} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => startEdit(rule)}>Modifica</Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => duplicateRule(rule).catch(() => toast.error('Duplicazione non riuscita'))}><Copy className="h-3.5 w-3.5" />Duplica</Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => patchRule(rule, { is_active: !rule.is_active }).catch(() => toast.error('Aggiornamento non riuscito'))}>{rule.is_active ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}{rule.is_active ? 'Disattiva' : 'Riattiva'}</Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => previewRule(rule.id)}><FlaskConical className="h-3.5 w-3.5" />Anteprima</Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => applyBulk(rule)}><Play className="h-3.5 w-3.5" />Applica</Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => patchRule(rule, { archived: true, is_active: false }).catch(() => toast.error('Archivio non riuscito'))}><Archive className="h-3.5 w-3.5" />Archivia</Button>
                  <Button variant="outline" size="sm" className="gap-1 text-red-600" onClick={() => deleteRule(rule)}><Trash2 className="h-3.5 w-3.5" />Elimina</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {preview.length > 0 && (
        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardHeader><CardTitle className="text-lg">Anteprima corrispondenze</CardTitle><p className="text-sm text-slate-500">Questa è soltanto un’anteprima. Nessun movimento è stato modificato.</p></CardHeader>
          <CardContent className="space-y-3">
            {preview.map((row) => (
              <div key={row.transaction.id} className="rounded-2xl border border-[#e5e7f0] p-4">
                <p className="font-semibold text-slate-950">{row.transaction.description || 'Movimento'}</p>
                <p className="mt-1 text-sm text-slate-500">{row.transaction.date} · {formatCurrency(Number(row.transaction.amount))}</p>
                <p className="mt-2 text-xs text-indigo-600">Modifiche: {Object.keys(row.appliedValues).join(', ') || 'nessuna'}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-[#e5e7f0] bg-white shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5 text-indigo-500" />Storico applicazioni</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {applications.length === 0 ? <p className="text-sm text-slate-500">Nessuna applicazione registrata.</p> : applications.map((item) => (
            <div key={item.id} className="flex flex-col justify-between gap-2 rounded-2xl border border-[#e5e7f0] p-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold text-slate-950">{item.application_mode} · {item.result}</p>
                <p className="text-sm text-slate-500">{new Date(item.applied_at).toLocaleString('it-IT')} · campi: {Object.keys(item.applied_values ?? {}).join(', ') || 'nessuno'}</p>
              </div>
              {item.application_batch_id && item.result === 'APPLIED' && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => revertBatch(item.application_batch_id!)}><RefreshCcw className="h-3.5 w-3.5" />Annulla batch</Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4">
          <div className="my-8 w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">{form.id ? 'Modifica regola' : 'Nuova regola'}</h2>
                <p className="mt-1 text-sm text-slate-500">Quando le condizioni corrispondono, Aurora propone o applica le azioni selezionate.</p>
              </div>
              <Button variant="outline" onClick={() => setFormOpen(false)}>Chiudi</Button>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Priorità"><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></Field>
              <Field label="Descrizione contiene">
                <div className="grid gap-2 sm:grid-cols-[170px_1fr]">
                  <select className="h-10 rounded-md border border-[#e5e7f0] px-3 text-sm" value={form.description_operator} onChange={(e) => setForm({ ...form, description_operator: e.target.value as RuleForm['description_operator'] })}>
                    <option value="CONTAINS">Contiene</option>
                    <option value="EQUALS">Uguale a</option>
                    <option value="STARTS_WITH">Inizia con</option>
                    <option value="ENDS_WITH">Finisce con</option>
                    <option value="NOT_CONTAINS">Non contiene</option>
                  </select>
                  <Input value={form.description_value} onChange={(e) => setForm({ ...form, description_value: e.target.value })} placeholder="NETFLIX" />
                </div>
              </Field>
              <Field label="Tipo movimento">
                <select className="h-10 rounded-md border border-[#e5e7f0] px-3 text-sm" value={form.transaction_type} onChange={(e) => setForm({ ...form, transaction_type: e.target.value as RuleForm['transaction_type'] })}>
                  <option value="any">Qualsiasi</option>
                  <option value="income">Entrata</option>
                  <option value="expense">Uscita</option>
                  <option value="transfer">Giroconto</option>
                </select>
              </Field>
              <Field label="Assegna categoria">
                <select className="h-10 rounded-md border border-[#e5e7f0] px-3 text-sm" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">Non modificare</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.icon} {category.name}</option>)}
                </select>
              </Field>
              <Field label="Assegna conto">
                <select className="h-10 rounded-md border border-[#e5e7f0] px-3 text-sm" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                  <option value="">Non modificare</option>
                  {accounts.filter((account) => account.is_active && !account.is_hidden).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </Field>
              <Field label="Normalizza descrizione"><Input value={form.normalize_description} onChange={(e) => setForm({ ...form, normalize_description: e.target.value })} placeholder="NETFLIX" /></Field>
              <Field label="Aggiungi nota"><Input value={form.append_note} onChange={(e) => setForm({ ...form, append_note: e.target.value })} /></Field>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.apply_to_new_transactions} onChange={(e) => setForm({ ...form, apply_to_new_transactions: e.target.checked })} />Applica automaticamente ai nuovi movimenti</label>
              <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.stop_processing} onChange={(e) => setForm({ ...form, stop_processing: e.target.checked })} />Interrompi regole successive</label>
              <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />Regola attiva</label>
              <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.match_mode === 'ANY'} onChange={(e) => setForm({ ...form, match_mode: e.target.checked ? 'ANY' : 'ALL' })} />Basta una condizione</label>
            </div>

            <p className="mt-5 rounded-2xl bg-indigo-50 p-4 text-sm font-medium text-indigo-800">
              {form.description_value ? `Quando la descrizione ${form.description_operator.toLowerCase()} "${form.description_value}", applica le azioni selezionate.` : 'Aggiungi una condizione per vedere il riepilogo della regola.'}
            </p>
            {testResult && <p aria-live="polite" className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{testResult}</p>}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {form.id && <Button variant="outline" onClick={() => previewRule()}>Anteprima</Button>}
              {form.id && <Button variant="outline" onClick={() => testRule()}>Prova regola</Button>}
              <Button onClick={saveRule} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salva regola</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'green' | 'amber' | 'red' }) {
  const color = tone === 'green' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : tone === 'red' ? 'text-red-600' : 'text-slate-950'
  return (
    <Card className="border-[#e5e7f0] bg-white shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className={cn('mt-2 text-2xl font-bold tabular-nums', color)}>{value}</p>
      </CardContent>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}
