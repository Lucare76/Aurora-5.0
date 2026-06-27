import { Badge } from '@/components/ui/badge'

interface CategoryBadgeProps {
  name: string
  color?: string | null
}

export function CategoryBadge({ name, color }: CategoryBadgeProps) {
  return (
    <Badge
      variant="secondary"
      style={color ? { backgroundColor: `${color}20`, color } : undefined}
    >
      {name}
    </Badge>
  )
}
