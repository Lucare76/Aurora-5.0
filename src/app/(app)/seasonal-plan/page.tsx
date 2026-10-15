'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  CartesianGrid,
  Legend,
  ReferenceLine,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DateInput } from '@/components/ui/date-input'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  emptyPlan,
  monthKeys,
  type SeasonalPlan,
} from '@/lib/seasonal-plan/schema'
import type { SeasonalForecast } from '@/lib/seasonal-plan/engine'
type Payload = {
  plan: SeasonalPlan
  saved: boolean
  forecast: SeasonalForecast
  accounts: Array<{ id: string; name: string; balance: number; type: string }>
  automaticCommitments: Array<{
    id: string
    title: string
    date: string
    amount: number | null
    source: string
  }>
}
const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm'
const monthLabel = (month: string) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  })
export default function SeasonalPlanPage() {
  const [data, setData] = useState<Payload | null>(null)
  const [plan, setPlan] = useState<SeasonalPlan | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [template, setTemplate] = useState({
    start: '',
    length: 8,
    salary: 1750,
    naspi: 1000,
  })
  useEffect(() => {
    let active = true
    fetch('/api/seasonal-plan', { cache: 'no-store' })
      .then(async (r) => {
        const p = await r.json()
        if (!r.ok) throw new Error(p.error)
        return p as Payload
      })
      .then((p) => {
        if (!active) return
        const keys = monthKeys(p.forecast.from)
        const defaults = emptyPlan(p.forecast.from).months
        const missing = keys.some(
          (key) => !p.plan.months.some((m) => m.month === key),
        )
        setData(p)
        setPlan({
          ...p.plan,
          reviewed: missing ? false : p.plan.reviewed,
          months: keys.map(
            (key, i) =>
              p.plan.months.find((m) => m.month === key) ?? defaults[i],
          ),
        })
        setDirty(missing)
      })
      .catch((e) => active && setError(e.message || 'Piano non disponibile'))
    return () => {
      active = false
    }
  }, [])
  function edit(next: SeasonalPlan) {
    setPlan({
      ...next,
      reviewed: next.reviewed === plan?.reviewed ? false : next.reviewed,
    })
    setDirty(true)
  }
  async function calculate(save: boolean) {
    if (!plan) return
    setBusy(true)
    setError('')
    try {
      const r = await fetch(
        `/api/seasonal-plan${save ? '' : '?preview=true'}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(plan),
        },
      )
      const p = await r.json()
      if (!r.ok) throw new Error(p.error)
      setData(p)
      setPlan(p.plan)
      setDirty(false)
      toast.success(
        save ? 'Piano salvato' : 'Anteprima aggiornata: non ancora salvata',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calcolo non riuscito')
    } finally {
      setBusy(false)
    }
  }
  if (!data || !plan)
    return (
      <div className="p-6" role={error ? 'alert' : 'status'}>
        {error || 'Caricamento piano stagionale…'}
      </div>
    )
  const forecast = data.forecast
  const ready = !dirty && forecast.complete
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-3 sm:p-6">
      <header>
        <p className="text-sm font-medium text-indigo-600">
          Previsioni personali
        </p>
        <h1 className="text-2xl font-semibold text-slate-950">
          Piano stagionale
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Quanto puoi spendere oggi mantenendo coperti anche i mesi con meno
          entrate? Pianifica da {formatDate(forecast.from)} a{' '}
          {formatDate(forecast.to)}.
        </p>
      </header>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {dirty && (
        <p
          role="status"
          className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
        >
          Hai modifiche da calcolare. Aggiorna l’anteprima o salva il piano
          prima di leggere la disponibilità.
        </p>
      )}
      {!data.saved && (
        <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">
          Questa è un’anteprima. Verifica il piano e premi “Salva piano” per
          ritrovarlo al prossimo accesso.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          title="Spendibile oggi · solo entrate confermate"
          value={ready ? forecast.spendableConfirmed : null}
          note="Dopo tutti gli impegni e la riserva nei prossimi 12 mesi."
        />
        <Metric
          title="Spendibile includendo le stime"
          value={ready ? forecast.spendableEstimated : null}
          note="Include anche stipendio e NASpI non ancora confermati."
        />
        <Metric
          title="Liquidità iniziale selezionata"
          value={dirty ? null : forecast.openingBalance}
          note={`Riserva da proteggere: ${formatCurrency(plan.reserve)}.`}
        />
      </div>
      {!forecast.complete && !dirty && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          La disponibilità compare dopo aver verificato tutti i 12 mesi, i conti
          e le spese. Anche un mese senza entrate va confermato con importo
          zero.
        </p>
      )}
      {!dirty && forecast.shortfall > 0 && (
        <p
          role="status"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          Con le sole entrate confermate servono altri{' '}
          {formatCurrency(forecast.shortfall)} per proteggere la riserva. Punto
          più basso il {formatDate(forecast.minimumDate)}:{' '}
          {formatCurrency(forecast.minimumConfirmed)}.
        </p>
      )}
      <details open={!data.saved} className="rounded-2xl border bg-white p-4">
        <summary className="cursor-pointer font-semibold">
          Imposta il tuo piano
        </summary>
        <p className="mt-1 text-xs text-slate-500">
          Nessun movimento viene creato. I saldi reali cambiano solo nei
          Movimenti.
        </p>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium">
            Conti liquidi da utilizzare
          </legend>
          <p className="my-1 text-xs text-slate-500">
            Investimenti, ADI e conti di Aurora sono esclusi. Deseleziona i
            risparmi già destinati all’auto o ad altri obiettivi. Considera
            anche i debiti sulle carte.
          </p>
          <div className="flex flex-wrap gap-3">
            {data.accounts.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-2 rounded-lg border p-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={plan.account_ids.includes(a.id)}
                  onChange={(e) =>
                    edit({
                      ...plan,
                      account_ids: e.target.checked
                        ? [...plan.account_ids, a.id]
                        : plan.account_ids.filter((id) => id !== a.id),
                    })
                  }
                />
                {a.name} · {formatCurrency(Number(a.balance))}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="reserve">Riserva minima da non usare (€)</Label>
            <Input
              id="reserve"
              type="number"
              min="0"
              step="0.01"
              value={plan.reserve}
              onChange={(e) =>
                edit({ ...plan, reserve: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label htmlFor="everyday">Spese quotidiane extra al mese (€)</Label>
            <Input
              id="everyday"
              type="number"
              min="0"
              step="0.01"
              value={plan.monthly_extra_expenses}
              onChange={(e) =>
                edit({
                  ...plan,
                  monthly_extra_expenses: Number(e.target.value),
                })
              }
            />
            <p className="mt-1 text-xs text-slate-500">
              Spesa, carburante e imprevisti oltre agli impegni sotto. Nel mese
              in corso conta solo la quota dei giorni rimanenti.
            </p>
          </div>
        </div>
        <details className="mt-5 rounded-xl bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Compila un modello stipendio / NASpI
          </summary>
          <p className="mt-2 text-xs text-slate-600">
            Scegli l’inizio della stagione. Gli importi proposti sono
            modificabili; il modello imposta tutto come stimato. La NASpI non è
            calcolata da Aurora e va verificata mese per mese.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor="season-start">Primo mese di stipendio</Label>
              <select
                id="season-start"
                value={template.start}
                className={selectClass}
                onChange={(e) =>
                  setTemplate({ ...template, start: e.target.value })
                }
              >
                <option value="">Scegli mese</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={String(i + 1)}>
                    {new Date(2026, i, 1).toLocaleDateString('it-IT', {
                      month: 'long',
                    })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="season-length">Mesi di stipendio</Label>
              <Input
                id="season-length"
                type="number"
                min="1"
                max="12"
                value={template.length}
                onChange={(e) =>
                  setTemplate({ ...template, length: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label htmlFor="salary">Stipendio netto (€)</Label>
              <Input
                id="salary"
                type="number"
                min="0"
                step="0.01"
                value={template.salary}
                onChange={(e) =>
                  setTemplate({ ...template, salary: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label htmlFor="naspi">NASpI stimata (€)</Label>
              <Input
                id="naspi"
                type="number"
                min="0"
                step="0.01"
                value={template.naspi}
                onChange={(e) =>
                  setTemplate({ ...template, naspi: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <Button
            type="button"
            className="mt-3"
            variant="outline"
            disabled={
              !template.start || template.length < 1 || template.length > 12
            }
            onClick={() =>
              edit({
                ...plan,
                reviewed: false,
                months: plan.months.map((m) => {
                  const season =
                    (Number(m.month.slice(5)) - Number(template.start) + 12) %
                      12 <
                    template.length
                  return {
                    ...m,
                    kind: season ? 'SALARY' : 'NASPI',
                    amount: season ? template.salary : template.naspi,
                    confidence: 'ESTIMATED',
                    received: false,
                  }
                }),
              })
            }
          >
            Applica modello ai 12 mesi
          </Button>
        </details>
        <h3 className="mt-5 text-sm font-semibold">Entrate mese per mese</h3>
        <p className="mt-1 text-xs text-slate-500">
          Le entrate qui indicate sostituiscono le entrate ricorrenti nella sola
          simulazione. Includi qui tutte le entrate attese del mese; puoi
          separare una seconda entrata con affidabilità diversa. Se un importo è
          già nel saldo, seleziona “Già incassato”. Per incassi parziali
          inserisci solo il residuo ancora atteso.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {plan.months.map((row, index) => (
            <fieldset key={row.month} className="min-w-0 rounded-xl border p-3">
              <legend className="px-1 text-sm font-semibold capitalize">
                {monthLabel(row.month)}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const update = (patch: Partial<typeof row>) =>
                    edit({
                      ...plan,
                      months: plan.months.map((m, i) =>
                        i === index ? { ...m, ...patch } : m,
                      ),
                    })
                  return (
                    <>
                      <div>
                        <Label htmlFor={`kind-${index}`}>Entrata</Label>
                        <select
                          id={`kind-${index}`}
                          className={selectClass}
                          value={row.kind}
                          onChange={(e) =>
                            update({
                              kind: e.target.value as typeof row.kind,
                              ...(e.target.value === 'NONE'
                                ? { amount: 0 }
                                : {}),
                            })
                          }
                        >
                          <option value="NONE">Nessuna</option>
                          <option value="SALARY">Stipendio</option>
                          <option value="NASPI">NASpI</option>
                          <option value="OTHER">Altre / totale entrate</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor={`amount-${index}`}>Importo (€)</Label>
                        <Input
                          id={`amount-${index}`}
                          aria-label={`Importo ${monthLabel(row.month)}`}
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={row.kind === 'NONE'}
                          value={row.amount}
                          onChange={(e) =>
                            update({ amount: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`confidence-${index}`}>
                          Affidabilità
                        </Label>
                        <select
                          id={`confidence-${index}`}
                          className={selectClass}
                          value={row.confidence}
                          onChange={(e) =>
                            update({
                              confidence: e.target
                                .value as typeof row.confidence,
                            })
                          }
                        >
                          <option value="ESTIMATED">Stimata</option>
                          <option value="CONFIRMED">Confermata da me</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor={`day-${index}`}>
                          Giorno di incasso
                        </Label>
                        <Input
                          id={`day-${index}`}
                          type="number"
                          min="1"
                          max="31"
                          value={row.day}
                          onChange={(e) =>
                            update({ day: Number(e.target.value) })
                          }
                        />
                      </div>
                      <label className="col-span-2 flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={row.received}
                          onChange={(e) =>
                            update({ received: e.target.checked })
                          }
                        />
                        Già incassato: incluso nel saldo reale
                      </label>
                      <details className="col-span-2 rounded-lg bg-slate-50 p-2">
                        <summary className="cursor-pointer text-xs font-medium">
                          Seconda entrata nello stesso mese
                          {row.extra.amount > 0
                            ? ` · ${formatCurrency(row.extra.amount)}`
                            : ''}
                        </summary>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <Label htmlFor={`extra-label-${index}`}>
                              Descrizione seconda entrata
                            </Label>
                            <Input
                              id={`extra-label-${index}`}
                              value={row.extra.label}
                              onChange={(e) =>
                                update({
                                  extra: {
                                    ...row.extra,
                                    label: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor={`extra-amount-${index}`}>
                              Importo seconda entrata (€)
                            </Label>
                            <Input
                              id={`extra-amount-${index}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.extra.amount}
                              onChange={(e) =>
                                update({
                                  extra: {
                                    ...row.extra,
                                    amount: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor={`extra-day-${index}`}>
                              Giorno seconda entrata
                            </Label>
                            <Input
                              id={`extra-day-${index}`}
                              type="number"
                              min="1"
                              max="31"
                              value={row.extra.day}
                              onChange={(e) =>
                                update({
                                  extra: {
                                    ...row.extra,
                                    day: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="col-span-2">
                            <Label htmlFor={`extra-confidence-${index}`}>
                              Affidabilità seconda entrata
                            </Label>
                            <select
                              id={`extra-confidence-${index}`}
                              className={selectClass}
                              value={row.extra.confidence}
                              onChange={(e) =>
                                update({
                                  extra: {
                                    ...row.extra,
                                    confidence: e.target
                                      .value as typeof row.extra.confidence,
                                  },
                                })
                              }
                            >
                              <option value="ESTIMATED">Stimata</option>
                              <option value="CONFIRMED">
                                Confermata da me
                              </option>
                            </select>
                          </div>
                          <label className="col-span-2 flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={row.extra.received}
                              onChange={(e) =>
                                update({
                                  extra: {
                                    ...row.extra,
                                    received: e.target.checked,
                                  },
                                })
                              }
                            />
                            Seconda entrata già incassata
                          </label>
                        </div>
                      </details>
                    </>
                  )
                })()}
              </div>
            </fieldset>
          ))}
        </div>
        <details className="mt-5 rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Impegni già inclusi · ricorrenze e rate (
            {data.automaticCommitments.length})
          </summary>
          <p className="my-2 text-xs text-slate-500">
            Importi previsti, quindi stimati. Non aggiungerli di nuovo. I PAC
            già presenti come uscita ricorrente sono inclusi; gli altri vanno
            aggiunti sotto. I budget sono obiettivi di spesa, non nuovi
            addebiti, e non vengono sommati.
          </p>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
            {data.automaticCommitments.map((e) => (
              <li key={e.id} className="flex justify-between gap-3">
                <span>
                  {formatDate(e.date)} · {e.title}
                </span>
                <span className="whitespace-nowrap">
                  {formatCurrency(e.amount ?? 0)}
                </span>
              </li>
            ))}
          </ul>
          <Link
            className="mt-2 inline-block text-sm text-indigo-600 underline"
            href="/recurring"
          >
            Gestisci ricorrenti
          </Link>
        </details>
        <h3 className="mt-5 text-sm font-semibold">
          Altri impegni mensili · spese fisse e PAC
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Aggiungi solo uscite non presenti sopra. La data iniziale è il
          prossimo addebito ancora da pagare. Dopo un pagamento aggiorna questa
          data se non usi una ricorrenza. Le uscite anteriori a oggi sono
          escluse.
        </p>
        <div className="mt-3 space-y-3">
          {plan.commitments.map((c, index) => {
            const update = (patch: Partial<typeof c>) =>
              edit({
                ...plan,
                commitments: plan.commitments.map((v, i) =>
                  i === index ? { ...v, ...patch } : v,
                ),
              })
            return (
              <fieldset key={c.id} className="rounded-xl border p-3">
                <legend className="px-1 text-sm">Impegno {index + 1}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <Label htmlFor={`title-${c.id}`}>Descrizione</Label>
                    <Input
                      id={`title-${c.id}`}
                      value={c.title}
                      onChange={(e) => update({ title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`cost-${c.id}`}>Importo mensile (€)</Label>
                    <Input
                      id={`cost-${c.id}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={c.amount || ''}
                      onChange={(e) =>
                        update({ amount: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`type-${c.id}`}>Tipo</Label>
                    <select
                      id={`type-${c.id}`}
                      className={selectClass}
                      value={c.kind}
                      onChange={(e) =>
                        update({ kind: e.target.value as typeof c.kind })
                      }
                    >
                      <option value="FIXED">Spesa fissa</option>
                      <option value="PAC">PAC / accantonamento</option>
                      <option value="OTHER">Altro</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor={`start-${c.id}`}>Prossimo addebito</Label>
                    <DateInput
                      id={`start-${c.id}`}
                      value={c.start_date}
                      onChange={(e) => update({ start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`end-${c.id}`}>
                      Ultima data da includere
                    </Label>
                    <DateInput
                      id={`end-${c.id}`}
                      value={c.end_date}
                      onChange={(e) => update({ end_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`status-${c.id}`}>Importo</Label>
                    <select
                      id={`status-${c.id}`}
                      className={selectClass}
                      value={c.confidence}
                      onChange={(e) =>
                        update({
                          confidence: e.target.value as typeof c.confidence,
                        })
                      }
                    >
                      <option value="ESTIMATED">Stimato</option>
                      <option value="CONFIRMED">Confermato da me</option>
                    </select>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2 text-red-600"
                  onClick={() =>
                    edit({
                      ...plan,
                      commitments: plan.commitments.filter(
                        (v) => v.id !== c.id,
                      ),
                    })
                  }
                >
                  Rimuovi impegno {index + 1}
                </Button>
              </fieldset>
            )
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() =>
            edit({
              ...plan,
              commitments: [
                ...plan.commitments,
                {
                  id: crypto.randomUUID(),
                  title: '',
                  kind: 'FIXED',
                  amount: 0,
                  start_date: forecast.from,
                  end_date: forecast.to,
                  confidence: 'ESTIMATED',
                },
              ],
            })
          }
        >
          Aggiungi spesa fissa o PAC
        </Button>
        <label className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={plan.reviewed}
            onChange={(e) => edit({ ...plan, reviewed: e.target.checked })}
          />
          Ho verificato tutti i mesi, le entrate ancora da incassare, i conti,
          le spese quotidiane e gli impegni, evitando duplicati.
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void calculate(false)}
          >
            Calcola anteprima
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void calculate(true)}
          >
            {busy ? 'Calcolo…' : 'Salva piano'}
          </Button>
        </div>
      </details>
      {!dirty && (
        <section className="min-w-0 rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">Come attraversi la stagione</h2>
          <p className="my-2 text-xs text-slate-500">
            Entrambe le linee includono tutte le uscite, anche quelle stimate.
            Il primo mese mostra solo ciò che resta da oggi. La disponibilità
            usa il minimo lungo l’intero percorso, non solo il saldo a fine
            mese.
          </p>
          <div
            className="h-64 min-w-0"
            aria-label="Saldi previsti nei prossimi dodici mesi"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecast.rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <Legend />
                <ReferenceLine
                  y={forecast.reserve}
                  stroke="#d97706"
                  strokeDasharray="4 4"
                  label="Riserva"
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={(v) => String(v).slice(5)}
                />
                <YAxis
                  width={65}
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  labelFormatter={(v) => monthLabel(String(v))}
                />
                <Line
                  type="monotone"
                  dataKey="closingConservative"
                  stroke="#4f46e5"
                  name="Solo entrate confermate"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="closing"
                  stroke="#059669"
                  name="Anche entrate stimate"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="mb-2 text-left">
                Piano mensile in euro · saldi di fine mese
              </caption>
              <thead>
                <tr>
                  {[
                    'Mese',
                    'Entrate confermate',
                    'Entrate stimate',
                    'Uscite confermate',
                    'Uscite stimate',
                    'Saldo solo confermate',
                    'Saldo con stime',
                  ].map((t) => (
                    <th key={t} className="p-2">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forecast.rows.map((row) => (
                  <tr
                    key={row.month}
                    className={row.belowReserve ? 'bg-amber-50' : 'border-t'}
                  >
                    <th className="whitespace-nowrap p-2 capitalize">
                      {monthLabel(row.month)}
                    </th>
                    {[
                      row.confirmedIncome,
                      row.estimatedIncome,
                      row.confirmedExpenses,
                      row.estimatedExpenses,
                      row.closingConservative,
                      row.closing,
                    ].map((v, i) => (
                      <td key={i} className="whitespace-nowrap p-2">
                        {formatCurrency(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            “Confermato” è una tua indicazione, non una verifica bancaria. Il
            calcolo considera prima le uscite e poi le entrate nello stesso
            giorno e non permette di spendere oggi denaro futuro. Rivedi il
            piano a ogni incasso o variazione. Prestiti e altri impegni non
            ricorrenti vanno aggiunti agli impegni se non già rappresentati.
          </p>
        </section>
      )}
      <p className="text-xs text-slate-500">
        La simulazione non modifica le previsioni del calendario o lo score
        finanziario: esplora qui il piano stagionale mantenendo distinguibili le
        tue ipotesi.
      </p>
    </div>
  )
}
function Metric({
  title,
  value,
  note,
}: {
  title: string
  value: number | null
  note: string
}) {
  return (
    <section className="rounded-2xl border bg-white p-4">
      <h2 className="text-xs font-medium text-slate-600">{title}</h2>
      <p className="mt-2 text-2xl font-semibold text-indigo-700">
        {value === null ? 'Da verificare' : formatCurrency(value)}
      </p>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </section>
  )
}
