export type SourceAsset = {
  id: string
  name: string
  source_type: 'SCALABLE' | 'POSTE' | 'MANUAL' | 'SCREENSHOT'
  observed_at: string
}

export function sourceHealth(assets: SourceAsset[], now: number) {
  return ([
    { key: 'SCALABLE', label: 'Scalable Capital', maxAgeDays: 2, members: assets.filter((asset) => asset.source_type === 'SCALABLE') },
    { key: 'POSTE', label: 'Poste Italiane', maxAgeDays: 30, members: assets.filter((asset) => asset.source_type === 'POSTE') },
    { key: 'MANUAL', label: 'Altri valori manuali', maxAgeDays: 7, members: assets.filter((asset) => asset.source_type === 'MANUAL' || asset.source_type === 'SCREENSHOT') },
  ] as const).map(({ key, label, maxAgeDays, members }) => {
    const dated = members.map((asset) => ({ asset, timestamp: Date.parse(asset.observed_at) }))
    const latest = dated.reduce<number | null>((value, item) =>
      Number.isFinite(item.timestamp) && (value === null || item.timestamp > value) ? item.timestamp : value, null)
    const overdue = dated.filter(({ timestamp }) => !Number.isFinite(timestamp) || now - timestamp > maxAgeDays * 86_400_000)
    return { key, label, count: members.length, latest: latest === null ? null : new Date(latest).toISOString(), overdue, maxAgeDays }
  })
}
