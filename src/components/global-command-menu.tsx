'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftRight,
  Activity,
  BadgeEuro,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Cake,
  CalendarDays,
  Command,
  DatabaseBackup,
  Download,
  FlaskConical,
  HandCoins,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  PiggyBank,
  Plus,
  Repeat,
  RefreshCw,
  ScanSearch,
  Search,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Tag,
  Target,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGlobalSearch } from '@/hooks/use-global-search'
import { cn } from '@/lib/utils'
import type { QuickCommand, SearchGroup, SearchResult, SearchResultType } from '@/lib/search/types'

type CommandItem =
  | { kind: 'quick'; id: string; group: string; title: string; subtitle: string; href: string; icon: LucideIcon; keywords: string[] }
  | { kind: 'result'; id: string; group: string; result: SearchResult; icon: LucideIcon }

const typeIcons: Record<SearchResultType, LucideIcon> = {
  TRANSACTION: ArrowLeftRight,
  ACCOUNT: Wallet,
  CATEGORY: Tag,
  BUDGET: Target,
  GOAL: Target,
  LOAN: HandCoins,
  RECURRENCE: Repeat,
  AUTOMATION_RULE: Sparkles,
}

function getAssistantQuickCommands(financialAssistantEnabled: boolean): Array<QuickCommand & { icon: LucideIcon }> {
  return financialAssistantEnabled
    ? [
      { id: 'assistant-open', group: 'Navigazione', title: 'Apri Chiedi ad Aurora', subtitle: 'Chat finanziaria deterministica in sola lettura', href: '/assistant', keywords: ['chiedi ad aurora', 'assistente', 'chat finanziaria'], icon: MessageCircle },
      { id: 'assistant-spending-month', group: 'Azioni rapide', title: 'Quanto ho speso questo mese?', subtitle: 'Apri la chat con una domanda sui movimenti', href: '/assistant?q=Quanto%20ho%20speso%20questo%20mese%3F', keywords: ['spese mese', 'quanto ho speso'], icon: MessageCircle },
      { id: 'assistant-emergency-fund', group: 'Azioni rapide', title: 'Controlla il fondo di emergenza', subtitle: 'Chiedi quanti mesi copre la liquidità', href: '/assistant?q=Quanti%20mesi%20copre%20il%20mio%20fondo%20di%20emergenza%3F', keywords: ['fondo emergenza', 'mesi senza reddito'], icon: MessageCircle },
      { id: 'assistant-health', group: 'Azioni rapide', title: 'Spiega Financial Health', subtitle: 'Chiedi quali fattori incidono sullo score', href: '/assistant?q=Perche%20il%20mio%20Financial%20Health%20e%20cambiato%3F', keywords: ['financial health', 'score', 'spiega salute finanziaria'], icon: MessageCircle },
    ]
    : []
}

export const quickCommands: Array<QuickCommand & { icon: LucideIcon }> = [
  { id: 'new-transaction', group: 'Azioni rapide', title: 'Nuovo movimento', subtitle: 'Apri il form transazioni', href: '/transactions?action=create', keywords: ['nuova transazione', 'nuovo movimento', 'entrata', 'uscita'], icon: Plus },
  { id: 'new-transfer', group: 'Azioni rapide', title: 'Nuovo trasferimento', subtitle: 'Apri i movimenti e scegli Giroconto', href: '/transactions?action=create&type=transfer', keywords: ['giroconto', 'trasferimento'], icon: ArrowLeftRight },
  { id: 'new-budget', group: 'Azioni rapide', title: 'Nuovo budget', subtitle: 'Crea un budget mensile', href: '/budgets?action=create', keywords: ['budget', 'nuovo budget'], icon: Target },
  { id: 'new-goal', group: 'Azioni rapide', title: 'Nuovo obiettivo', subtitle: 'Crea un obiettivo di risparmio', href: '/goals?action=create', keywords: ['obiettivo', 'risparmio'], icon: Target },
  { id: 'add-goal-contribution', group: 'Azioni rapide', title: 'Aggiungi versamento', subtitle: 'Vai agli obiettivi e scegli il traguardo', href: '/goals?action=contribution', keywords: ['versamento', 'aggiungi versamento'], icon: Plus },
  { id: 'new-loan', group: 'Azioni rapide', title: 'Nuovo prestito', subtitle: 'Apri la pagina prestiti', href: '/loans?action=create', keywords: ['prestito'], icon: HandCoins },
  { id: 'new-recurring', group: 'Azioni rapide', title: 'Nuova ricorrenza', subtitle: 'Apri il form ricorrenti', href: '/recurring?action=create', keywords: ['ricorrenza', 'abbonamento'], icon: Repeat },
  { id: 'new-automation-rule', group: 'Azioni rapide', title: 'Nuova regola', subtitle: 'Crea una regola di automazione', href: '/automation?action=create', keywords: ['automazione', 'regola', 'classificazione'], icon: Sparkles },
  { id: 'automation-history', group: 'Azioni rapide', title: 'Storico automazioni', subtitle: 'Controlla applicazioni e batch', href: '/automation?tab=history', keywords: ['storico automazioni', 'batch', 'regole applicate'], icon: Sparkles },
  { id: 'calendar-today', group: 'Azioni rapide', title: 'Vai a oggi', subtitle: 'Apri il calendario sul mese corrente', href: `/calendar?view=month&month=${new Date().toLocaleDateString('en-CA').slice(0, 7)}`, keywords: ['calendario', 'oggi', 'scadenze'], icon: CalendarDays },
  { id: 'calendar-30', group: 'Azioni rapide', title: 'Prossimi 30 giorni', subtitle: 'Apri l’agenda finanziaria', href: '/calendar?view=agenda&range=30', keywords: ['agenda', 'prossimi 30 giorni', 'previsioni'], icon: CalendarDays },
  { id: 'import', group: 'Azioni rapide', title: 'Importa movimenti', subtitle: 'Importa estratti e movimenti', href: '/import-estratti', keywords: ['importa', 'importazioni'], icon: Download },
  { id: 'backup', group: 'Azioni rapide', title: 'Crea backup', subtitle: 'Vai a backup e ripristino', href: '/settings#backup', keywords: ['backup', 'ripristino'], icon: DatabaseBackup },
  { id: 'notifications-unread', group: 'Azioni rapide', title: 'Avvisi non letti', subtitle: 'Vedi avvisi non letti', href: '/notifications?status=unread', keywords: ['avvisi', 'notifiche', 'non letti', 'alert'], icon: Bell },
  { id: 'notifications-critical', group: 'Azioni rapide', title: 'Avvisi critici', subtitle: 'Vedi avvisi critici', href: '/notifications?severity=CRITICAL', keywords: ['avvisi critici', 'critici'], icon: Bell },
  { id: 'notifications-snoozed', group: 'Azioni rapide', title: 'Avvisi posticipati', subtitle: 'Vedi avvisi posticipati', href: '/notifications?status=snoozed', keywords: ['posticipati', 'snoozed', 'posticipate'], icon: Bell },
  { id: 'notification-settings', group: 'Azioni rapide', title: 'Impostazioni avvisi', subtitle: 'Soglie, preferenze e fonti silenziate', href: '/settings/notifications', keywords: ['impostazioni avvisi', 'notifiche impostazioni', 'preferenze notifiche', 'soglie'], icon: Bell },
  { id: 'notification-mutes', group: 'Azioni rapide', title: 'Fonti silenziate', subtitle: 'Gestisci le fonti silenziate', href: '/settings/notifications#mutes', keywords: ['silenziata', 'mute', 'fonti silenziate'], icon: Bell },
  { id: 'financial-health-open', group: 'Azioni rapide', title: 'Apri salute finanziaria', subtitle: 'Verifica score e componenti', href: '/financial-health', keywords: ['salute finanziaria', 'score', 'punteggio'], icon: Activity },
  { id: 'financial-health-calculate', group: 'Azioni rapide', title: 'Calcola salute finanziaria', subtitle: 'Apri il motore live', href: '/financial-health', keywords: ['calcola salute finanziaria', 'ricalcola score'], icon: Activity },
  { id: 'financial-health-history', group: 'Azioni rapide', title: 'Storico salute finanziaria', subtitle: 'Apri lo storico snapshot', href: '/financial-health#history', keywords: ['storico salute finanziaria', 'snapshot salute'], icon: Activity },
  { id: 'financial-health-snapshot', group: 'Azioni rapide', title: 'Salva snapshot del mese', subtitle: 'Apri la pagina e salva lo snapshot', href: '/financial-health', keywords: ['salva snapshot', 'snapshot mese'], icon: DatabaseBackup },
  { id: 'dashboard-customize', group: 'Azioni rapide', title: 'Personalizza dashboard', subtitle: 'Mostra, nascondi e riordina i widget', href: '/dashboard?settings=open', keywords: ['personalizza dashboard', 'widget', 'preferenze dashboard'], icon: LayoutDashboard },
  { id: 'dashboard-refresh-health', group: 'Azioni rapide', title: 'Aggiorna panoramica', subtitle: 'Ricalcola la dashboard finanziaria', href: '/dashboard', keywords: ['aggiorna dashboard', 'ricalcola dashboard', 'salute finanziaria dashboard'], icon: RefreshCw },
  { id: 'data-integrity-open', group: 'Azioni rapide', title: 'Apri integrità dati', subtitle: 'Controlla anomalie e riferimenti incoerenti', href: '/data-integrity', keywords: ['integrità dati', 'data integrity', 'anomalie'], icon: ScanSearch },
  { id: 'data-integrity-scan', group: 'Azioni rapide', title: 'Avvia scansione rapida', subtitle: 'Apri il centro integrità e conferma la scansione', href: '/data-integrity?action=scan', keywords: ['scansione dati', 'scan dati', 'controlla dati'], icon: ScanSearch },
  { id: 'data-integrity-critical', group: 'Azioni rapide', title: 'Problemi critici', subtitle: 'Vedi anomalie critical aperte', href: '/data-integrity?severity=CRITICAL&status=open', keywords: ['critical', 'problemi critici', 'anomalie critiche'], icon: ShieldAlert },
  { id: 'data-integrity-duplicates', group: 'Azioni rapide', title: 'Transazioni duplicate', subtitle: 'Filtra possibili duplicati', href: '/data-integrity?rule=TRANSACTION_POSSIBLE_DUPLICATE', keywords: ['duplicati', 'transazioni duplicate'], icon: ScanSearch },
  { id: 'data-integrity-transfers', group: 'Azioni rapide', title: 'Giroconti incompleti', subtitle: 'Filtra anomalie sui giroconti', href: '/data-integrity?category=transfers', keywords: ['giroconti incompleti', 'transfer'], icon: ArrowLeftRight },
  { id: 'new-scenario', group: 'Azioni rapide', title: 'Nuovo scenario', subtitle: 'Crea uno scenario "what if"', href: '/scenarios/new', keywords: ['scenario', 'simulazione', 'what if', 'nuovo scenario'], icon: FlaskConical },
  { id: 'scenarios-list', group: 'Azioni rapide', title: 'I miei scenari', subtitle: 'Vedi tutti gli scenari finanziari', href: '/scenarios', keywords: ['scenari', 'simulazioni', 'proiezioni'], icon: FlaskConical },
  { id: 'report-monthly', group: 'Azioni rapide', title: 'Report mensile', subtitle: 'Genera il report del mese corrente', href: '/reports?range=current-month&type=both', keywords: ['report mensile', 'mese corrente', 'report'], icon: BarChart3 },
  { id: 'report-annual', group: 'Azioni rapide', title: 'Report annuale', subtitle: 'Genera il report dell\'anno corrente', href: '/reports?range=current-year&type=both', keywords: ['report annuale', 'anno corrente', 'annuale'], icon: BarChart3 },
  { id: 'report-expenses', group: 'Azioni rapide', title: 'Analisi uscite', subtitle: 'Report uscite ultimi 6 mesi', href: '/reports?range=last-6-months&type=expense', keywords: ['analisi uscite', 'uscite', 'spese'], icon: BarChart3 },
  { id: 'report-income', group: 'Azioni rapide', title: 'Analisi entrate', subtitle: 'Report entrate ultimi 6 mesi', href: '/reports?range=last-6-months&type=income', keywords: ['analisi entrate', 'entrate'], icon: BarChart3 },
  { id: 'report-net-worth', group: 'Azioni rapide', title: 'Patrimonio netto', subtitle: 'Evoluzione patrimonio ultimi 12 mesi', href: '/reports?range=last-12-months&type=both', keywords: ['patrimonio netto', 'net worth', 'patrimonio'], icon: BarChart3 },
  { id: 'report-templates', group: 'Azioni rapide', title: 'Template report', subtitle: 'Scegli tra 19 template disponibili', href: '/reports/new', keywords: ['template report', 'tutti i report', 'nuovo report'], icon: BarChart3 },
  { id: 'dashboard', group: 'Navigazione', title: 'Dashboard', subtitle: 'Panoramica principale', href: '/dashboard', keywords: ['home', 'dashboard'], icon: LayoutDashboard },
  { id: 'transactions', group: 'Navigazione', title: 'Movimenti', subtitle: 'Transazioni e giroconti', href: '/transactions', keywords: ['transazioni', 'movimenti'], icon: ArrowLeftRight },
  { id: 'accounts', group: 'Navigazione', title: 'Conti', subtitle: 'Risorse e saldi', href: '/accounts', keywords: ['conti', 'risorse'], icon: Wallet },
  { id: 'categories', group: 'Navigazione', title: 'Categorie', subtitle: 'Categorie e sottocategorie', href: '/categories', keywords: ['categorie'], icon: Tag },
  { id: 'budgets', group: 'Navigazione', title: 'Budget', subtitle: 'Budget mensili', href: '/budgets', keywords: ['budget'], icon: Target },
  { id: 'goals', group: 'Navigazione', title: 'Obiettivi', subtitle: 'Obiettivi di risparmio', href: '/goals', keywords: ['obiettivi', 'risparmio'], icon: Target },
  { id: 'reports', group: 'Navigazione', title: 'Report', subtitle: 'Analisi e grafici', href: '/reports', keywords: ['report', 'grafici'], icon: BarChart3 },
  { id: 'financial-health', group: 'Navigazione', title: 'Salute finanziaria', subtitle: 'Score spiegabile e metriche predittive', href: '/financial-health', keywords: ['salute finanziaria', 'score', 'punteggio', 'metriche predittive'], icon: Activity },
  { id: 'data-integrity', group: 'Navigazione', title: 'Integrità dati', subtitle: 'Anomalie, duplicazioni e riferimenti', href: '/data-integrity', keywords: ['integrità dati', 'data integrity', 'anomalie', 'riconciliazione'], icon: ScanSearch },
  { id: 'calendar', group: 'Navigazione', title: 'Calendario', subtitle: 'Scadenze e saldo previsto', href: '/calendar', keywords: ['calendario', 'previsioni', 'scadenze'], icon: CalendarDays },
  { id: 'automation', group: 'Navigazione', title: 'Automazioni', subtitle: 'Regole deterministiche per i movimenti', href: '/automation', keywords: ['automazioni', 'regole', 'classificazione'], icon: Sparkles },
  { id: 'loans', group: 'Navigazione', title: 'Prestiti', subtitle: 'Prestiti dati e ricevuti', href: '/loans', keywords: ['prestiti'], icon: HandCoins },
  { id: 'recurring', group: 'Navigazione', title: 'Ricorrenti', subtitle: 'Movimenti ricorrenti', href: '/recurring', keywords: ['ricorrenti', 'abbonamenti'], icon: Repeat },
  { id: 'birthdays', group: 'Navigazione', title: 'Compleanni', subtitle: 'Promemoria compleanni', href: '/birthdays', keywords: ['compleanni'], icon: Cake },
  { id: 'settings', group: 'Navigazione', title: 'Impostazioni', subtitle: 'Profilo, dati, backup', href: '/settings', keywords: ['impostazioni', 'backup'], icon: Settings },
  { id: 'notifications', group: 'Navigazione', title: 'Avvisi', subtitle: 'Centro avvisi finanziari', href: '/notifications', keywords: ['avvisi', 'notifiche', 'alert'], icon: Bell },
  { id: 'scenarios', group: 'Navigazione', title: 'Scenari', subtitle: 'Simulazioni "what if"', href: '/scenarios', keywords: ['scenari', 'simulazioni', 'what if', 'proiezioni'], icon: FlaskConical },
  { id: 'affordability', group: 'Navigazione', title: 'Posso permettermelo?', subtitle: 'Valuta la sostenibilità di un acquisto', href: '/affordability', keywords: ['permettermelo', 'acquisto', 'sostenibilità', 'rata', 'spesa'], icon: ShoppingCart },
  { id: 'affordability-calculate', group: 'Azioni rapide', title: 'Valuta un acquisto', subtitle: 'Simula la sostenibilità di una spesa', href: '/affordability', keywords: ['valuta acquisto', 'posso permettermelo', 'sostenibile', 'rata sostenibile', 'affordability'], icon: ShoppingCart },
]

const privateFinanceQuickCommands: Array<QuickCommand & { icon: LucideIcon }> = [
  { id: 'aurora-savings-open', group: 'Navigazione', title: 'Apri Risparmi di Aurora', subtitle: 'Patrimonio dedicato e separato', href: '/aurora', keywords: ['aurora', 'risparmi aurora', 'piano accumulo'], icon: PiggyBank },
  { id: 'aurora-new-account', group: 'Azioni rapide', title: 'Nuovo conto Aurora', subtitle: 'Crea un conto nel perimetro Aurora', href: '/aurora?action=new-account', keywords: ['nuovo conto aurora', 'conto aurora', 'fondo aurora'], icon: PiggyBank },
  { id: 'aurora-new-income', group: 'Azioni rapide', title: 'Nuova entrata Aurora', subtitle: 'Registra un versamento nel patrimonio Aurora', href: '/aurora?action=income', keywords: ['entrata aurora', 'versamento aurora'], icon: Plus },
  { id: 'aurora-new-transfer', group: 'Azioni rapide', title: 'Nuovo giroconto Aurora', subtitle: 'Sposta denaro tra personale e Aurora', href: '/aurora?action=transfer', keywords: ['giroconto aurora', 'trasferimento aurora'], icon: ArrowLeftRight },
  { id: 'adi-open', group: 'Navigazione', title: 'Apri gestione ADI', subtitle: 'Residuo, accrediti e spese ammesse', href: '/adi', keywords: ['adi', 'assegno inclusione', 'gestione adi'], icon: BadgeEuro },
  { id: 'adi-credit', group: 'Azioni rapide', title: 'Registra accredito ADI', subtitle: 'Aggiungi un accredito al fondo ADI separato', href: '/adi?action=credit', keywords: ['accredito adi', 'entrata adi'], icon: BadgeEuro },
  { id: 'adi-debit', group: 'Azioni rapide', title: 'Registra spesa ADI', subtitle: 'Registra una spesa pagata con ADI', href: '/adi?action=debit', keywords: ['spesa adi', 'pagato con adi', 'supermercato adi', 'benzina adi'], icon: BadgeEuro },
]

const privateHrQuickCommands: Array<QuickCommand & { icon: LucideIcon }> = [
  { id: 'leave-open', group: 'Navigazione', title: 'Apri Ferie e permessi', subtitle: 'Modulo privato separato dalla contabilità', href: '/leave', keywords: ['ferie', 'permessi', '104', 'permessi 104'], icon: BriefcaseBusiness },
  { id: 'leave-new-vacation', group: 'Azioni rapide', title: 'Nuove ferie', subtitle: 'Registra un giorno o un periodo di ferie', href: '/leave?action=vacation', keywords: ['nuove ferie', 'ferie', 'vacanza lavoro'], icon: BriefcaseBusiness },
  { id: 'leave-new-permit', group: 'Azioni rapide', title: 'Nuovo permesso 104', subtitle: 'Registra ore di permesso 104', href: '/leave?action=permit', keywords: ['nuovo permesso', 'permesso 104', 'legge 104'], icon: BriefcaseBusiness },
]

export function getQuickCommands(canAccessPrivateFinance: boolean, financialAssistantEnabled = false, canAccessPrivateHr = false): Array<QuickCommand & { icon: LucideIcon }> {
  const commands = [...getAssistantQuickCommands(financialAssistantEnabled), ...quickCommands]
  return [
    ...commands,
    ...(canAccessPrivateFinance ? privateFinanceQuickCommands : []),
    ...(canAccessPrivateHr ? privateHrQuickCommands : []),
  ]
}

function commandScore(query: string, command: QuickCommand): number {
  const q = query.toLowerCase().trim()
  if (!q) return 1
  const haystack = [command.title, command.subtitle, ...command.keywords].join(' ').toLowerCase()
  if (command.title.toLowerCase() === q) return 100
  if (command.title.toLowerCase().startsWith(q)) return 80
  if (haystack.includes(q)) return 50
  return 0
}

function groupItems(items: CommandItem[]) {
  const groups = new Map<string, CommandItem[]>()
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item])
  return [...groups.entries()]
}

export function GlobalCommandMenu({
  open,
  onOpenChange,
  canAccessPrivateFinance = false,
  canAccessPrivateHr = false,
  financialAssistantEnabled = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  canAccessPrivateFinance?: boolean
  canAccessPrivateHr?: boolean
  financialAssistantEnabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { data, loading, error, minQueryLength } = useGlobalSearch(open, query)
  const trimmed = query.trim()
  const visibleQuickCommands = useMemo(
    () => getQuickCommands(canAccessPrivateFinance, financialAssistantEnabled, canAccessPrivateHr),
    [canAccessPrivateFinance, financialAssistantEnabled, canAccessPrivateHr],
  )

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  const items = useMemo<CommandItem[]>(() => {
    const local = visibleQuickCommands
      .map((command) => ({ command, score: commandScore(trimmed, command) }))
      .filter(({ score }) => trimmed.length === 0 || score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ command }) => ({
        kind: 'quick' as const,
        id: command.id,
        group: command.group,
        title: command.title,
        subtitle: command.subtitle,
        href: command.href,
        icon: command.icon,
        keywords: command.keywords,
      }))

    const remote = (data?.groups ?? []).flatMap((group: SearchGroup) =>
      group.results.map((result) => ({
        kind: 'result' as const,
        id: `${result.type}-${result.id}`,
        group: group.label,
        result,
        icon: typeIcons[result.type],
      })),
    )

    return trimmed.length < minQueryLength ? local : [...local.slice(0, 5), ...remote]
  }, [data?.groups, minQueryLength, trimmed, visibleQuickCommands])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, data])

  useEffect(() => {
    const active = panelRef.current?.querySelector<HTMLElement>(`[data-command-index="${activeIndex}"]`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  const selectItem = (item: CommandItem) => {
    const href = item.kind === 'quick' ? item.href : item.result.href
    onOpenChange(false)
    router.push(href)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(items.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(Math.max(items.length - 1, 0))
      return
    }
    if (event.key === 'Enter' && items[activeIndex]) {
      event.preventDefault()
      selectItem(items[activeIndex])
    }
  }

  const grouped = groupItems(items)
  const showServerHint = trimmed.length > 0 && trimmed.length < minQueryLength

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Ricerca globale">
      <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} aria-label="Chiudi ricerca globale" />
      <div className="absolute inset-x-2 top-4 mx-auto flex max-h-[calc(100vh-2rem)] max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#e5e7f0] bg-white shadow-2xl sm:top-[8vh]">
        <div className="flex items-center gap-3 border-b border-[#e5e7f0] px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Cerca o esegui un’azione…"
            role="combobox"
            aria-expanded="true"
            aria-controls="global-command-results"
            aria-activedescendant={items[activeIndex]?.id}
            className="h-11 min-w-0 flex-1 bg-transparent text-base font-medium text-slate-950 outline-none placeholder:text-slate-400"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />}
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onOpenChange(false)} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div ref={panelRef} id="global-command-results" role="listbox" className="max-h-[70vh] overflow-y-auto p-3">
          {showServerHint && (
            <p className="px-3 py-8 text-center text-sm text-slate-500">Digita almeno 2 caratteri per cercare nei dati di Aurora.</p>
          )}
          {error && (
            <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error === 'SESSION_EXPIRED' ? 'Sessione scaduta. Accedi di nuovo.' : 'Ricerca non riuscita. Riprova.'}
            </p>
          )}
          {!loading && !error && trimmed.length >= minQueryLength && (data?.totalResults ?? 0) === 0 && items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-slate-500">Nessun risultato per “{trimmed}”. Prova con un nome, una categoria o un importo.</p>
          )}
          {grouped.map(([group, groupItems]) => (
            <section key={group} className="mb-3 last:mb-0">
              <div className="mb-1 flex items-center justify-between px-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{group}</p>
                <span className="text-xs font-medium text-slate-300">{groupItems.length}</span>
              </div>
              <div className="space-y-1">
                {groupItems.map((item) => {
                  const index = items.indexOf(item)
                  const Icon = item.icon
                  const title = item.kind === 'quick' ? item.title : item.result.title
                  const sub = item.kind === 'quick' ? item.subtitle : item.result.subtitle
                  const type = item.kind === 'quick' ? 'Comando' : item.result.type
                  return (
                    <button
                      key={item.id}
                      id={item.id}
                      type="button"
                      data-command-index={index}
                      role="option"
                      aria-selected={activeIndex === index}
                      className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition', activeIndex === index ? 'bg-indigo-50 ring-1 ring-indigo-100' : 'hover:bg-slate-50')}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectItem(item)}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-950">{title}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{type}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[#e5e7f0] px-4 py-2 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Command className="h-3 w-3" /> Ctrl/Cmd K</span>
          <span>↑ ↓ naviga · Invio apri · Esc chiudi</span>
        </div>
      </div>
    </div>
  )
}
