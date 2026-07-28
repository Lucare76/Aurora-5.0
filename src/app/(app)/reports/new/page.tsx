import Link from 'next/link'
import { ArrowLeft, BarChart3, ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { REPORT_REGISTRY, REPORT_REGISTRY_BY_CATEGORY } from '@/lib/reports/registry'

const CATEGORY_LABELS: Record<string, string> = {
  periodic: 'Report periodici',
  thematic: 'Analisi tematiche',
  extended: 'Report estesi',
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  periodic: 'Report standard per periodo: mensile, trimestrale, annuale e personalizzato.',
  thematic: 'Analisi focalizzate su un aspetto specifico dei tuoi dati finanziari.',
  extended: 'Report che si collegano a moduli dedicati di Aurora per un\'analisi approfondita.',
}

const COLOR_CLASSES: Record<string, { bg: string; icon: string; border: string }> = {
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', border: 'border-indigo-100 hover:border-indigo-300' },
  violet: { bg: 'bg-violet-50', icon: 'text-violet-600', border: 'border-violet-100 hover:border-violet-300' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-100 hover:border-amber-300' },
  slate: { bg: 'bg-slate-50', icon: 'text-slate-600', border: 'border-slate-200 hover:border-slate-400' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100 hover:border-emerald-300' },
  red: { bg: 'bg-red-50', icon: 'text-red-600', border: 'border-red-100 hover:border-red-300' },
  sky: { bg: 'bg-sky-50', icon: 'text-sky-600', border: 'border-sky-100 hover:border-sky-300' },
  teal: { bg: 'bg-teal-50', icon: 'text-teal-600', border: 'border-teal-100 hover:border-teal-300' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-100 hover:border-purple-300' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-100 hover:border-orange-300' },
  pink: { bg: 'bg-pink-50', icon: 'text-pink-600', border: 'border-pink-100 hover:border-pink-300' },
  rose: { bg: 'bg-rose-50', icon: 'text-rose-600', border: 'border-rose-100 hover:border-rose-300' },
  cyan: { bg: 'bg-cyan-50', icon: 'text-cyan-600', border: 'border-cyan-100 hover:border-cyan-300' },
  green: { bg: 'bg-green-50', icon: 'text-green-600', border: 'border-green-100 hover:border-green-300' },
  yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', border: 'border-yellow-100 hover:border-yellow-300' },
  fuchsia: { bg: 'bg-fuchsia-50', icon: 'text-fuchsia-600', border: 'border-fuchsia-100 hover:border-fuchsia-300' },
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100 hover:border-blue-300' },
  lime: { bg: 'bg-lime-50', icon: 'text-lime-600', border: 'border-lime-100 hover:border-lime-300' },
  stone: { bg: 'bg-stone-50', icon: 'text-stone-500', border: 'border-stone-200 hover:border-stone-400' },
}

function fallbackColors(color: string) {
  return COLOR_CLASSES[color] ?? { bg: 'bg-slate-50', icon: 'text-slate-600', border: 'border-slate-200 hover:border-slate-400' }
}

export default function ReportsNewPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-950">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600">Analisi finanziaria</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Scegli un template</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {REPORT_REGISTRY.length} template disponibili. Seleziona quello più adatto alle tue esigenze.
            </p>
          </div>
          <Link href="/reports" className={buttonVariants({ variant: 'outline', className: 'h-10 gap-2' })}>
            <ArrowLeft className="h-4 w-4" />
            Torna ai report
          </Link>
        </header>

        {(['periodic', 'thematic', 'extended'] as const).map((category) => {
          const defs = REPORT_REGISTRY_BY_CATEGORY[category]
          return (
            <section key={category} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{CATEGORY_LABELS[category]}</h2>
                <p className="text-sm text-slate-500">{CATEGORY_DESCRIPTIONS[category]}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {defs.map((def) => {
                  const colors = fallbackColors(def.color)
                  const isExternal = def.category === 'extended' && !def.href.startsWith('/reports')
                  return (
                    <Link key={def.code} href={def.href} aria-label={`Genera ${def.label}`}>
                      <Card className={`h-full border transition ${colors.border} bg-white shadow-sm hover:shadow-md`}>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${colors.bg}`}>
                              <BarChart3 className={`h-5 w-5 ${colors.icon}`} />
                            </div>
                            {isExternal && (
                              <ExternalLink className="h-4 w-4 shrink-0 text-slate-300" aria-label="Apre in sezione dedicata" />
                            )}
                          </div>
                          <div className="mt-3">
                            <p className="font-semibold text-slate-900">{def.label}</p>
                            <p className="mt-1 text-sm text-slate-500">{def.description}</p>
                          </div>
                          {isExternal && (
                            <p className="mt-3 text-xs text-slate-400">Si apre nella sezione dedicata</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}

        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardContent className="p-5 text-sm text-slate-500">
            <p>
              I report sono generati esclusivamente dai tuoi dati reali — nessuna AI, nessuna stima, nessun dato esterno.
              I report periodici e tematici si aprono direttamente nella pagina report con i filtri preimpostati.
              I report estesi rimandano alle sezioni dedicate di Aurora.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
