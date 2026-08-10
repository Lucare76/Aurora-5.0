import Image from 'next/image'
import { cn } from '@/lib/utils'

const AURORA_ASSISTANT_IMAGE = '/images/aurora/aurora-assistant.jpg'

type AssistantAvatarProps = {
  size: 'header' | 'message'
  className?: string
}

export function AssistantAvatar({ size, className }: AssistantAvatarProps) {
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full border border-indigo-100 bg-white shadow-sm',
        size === 'header' ? 'h-14 w-14 sm:h-16 sm:w-16' : 'h-8 w-8',
        className,
      )}
    >
      <Image
        src={AURORA_ASSISTANT_IMAGE}
        alt="Aurora"
        fill
        priority={size === 'header'}
        sizes={size === 'header' ? '(max-width: 640px) 56px, 64px' : '32px'}
        className="object-cover object-center"
      />
    </div>
  )
}
