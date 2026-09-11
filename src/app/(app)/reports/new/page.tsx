import Link from 'next/link'
import { ArrowLeft, BarChart3, ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { REPORT_REGISTRY_BY_CATEGORY, RELATED_REPORT_TOOLS, REPORT_TEMPLATES, reportColorClasses } from '@/lib/reports/registry'

const CATEGORY_LABELS: Record<string, string> = {
  periodic: 'Report periodici',
  thematic: 'Analisi tematiche',
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  periodic: 'Report standard per periodo: mensile, trimestrale, annuale e personalizzato.',
  thematic: 'Analisi focalizzate su un aspetto specifico dei tuoi dati finanziari.',
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
              {REPORT_TEMPLATES.length} template disponibili. Seleziona quello più adatto alle tue esigenze.
            </p>
          </div>
          <Link href="/reports" className={buttonVariants({ variant: 'outline', className: 'h-10 gap-2' })}>
            <ArrowLeft className="h-4 w-4" />
            Torna ai report
          </Link>
        </header>

        {(['periodic', 'thematic'] as const).map((category) => {
          const defs = REPORT_REGISTRY_BY_CATEGORY[category]
          if (defs.length === 0) return null
          return (
            <section key={category} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{CATEGORY_LABELS[category]}</h2>
                <p className="text-sm text-slate-500">{CATEGORY_DESCRIPTIONS[category]}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {defs.map((def) => {
                  const colors = reportColorClasses(def.color)
                  return (
                    <Link key={def.code} href={def.href} aria-label={`Genera ${def.label}`}>
                      <Card className={`h-full border transition ${colors.border} bg-white shadow-sm hover:shadow-md`}>
                        <CardContent className="p-5">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${colors.bg}`}>
                            <BarChart3 className={`h-5 w-5 ${colors.icon}`} />
                          </div>
                          <div className="mt-3">
                            <p className="font-semibold text-slate-900">{def.label}</p>
                            <p className="mt-1 text-sm text-slate-500">{def.description}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Strumenti correlati</h2>
            <p className="text-sm text-slate-500">
              Non sono template del motore Report: aprono le rispettive sezioni dedicate di Aurora, con i loro dati e i loro filtri.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {RELATED_REPORT_TOOLS.map((def) => {
              const colors = reportColorClasses(def.color)
              return (
                <Link key={def.code} href={def.href} aria-label={`Apri ${def.label}`}>
                  <Card className={`h-full border transition ${colors.border} bg-white shadow-sm hover:shadow-md`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${colors.bg}`}>
                          <BarChart3 className={`h-5 w-5 ${colors.icon}`} />
                        </div>
                        <ExternalLink className="h-4 w-4 shrink-0 text-slate-300" aria-label="Apre in sezione dedicata" />
                      </div>
                      <div className="mt-3">
                        <p className="font-semibold text-slate-900">{def.label}</p>
                        <p className="mt-1 text-sm text-slate-500">{def.description}</p>
                      </div>
                      <p className="mt-3 text-xs text-slate-400">Si apre nella sezione dedicata</p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>

        <Card className="border-[#e5e7f0] bg-white shadow-sm">
          <CardContent className="p-5 text-sm text-slate-500">
            <p>
              I report sono generati esclusivamente dai tuoi dati reali — nessuna AI, nessuna stima, nessun dato esterno.
              I template si aprono direttamente nella pagina report con i filtri e le sezioni giuste già impostate.
              Gli strumenti correlati rimandano alle sezioni dedicate di Aurora.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
