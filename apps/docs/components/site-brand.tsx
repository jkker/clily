import { cn } from '@/lib/cn'
import { appName } from '@/lib/shared'

import { CliviaIcon } from './clivia-icon'

type SiteBrandProps = {
  className?: string
  kicker?: string
}

export function SiteBrand({ className, kicker = 'comfort over chrome' }: SiteBrandProps) {
  return (
    <span className={cn('brand', className)}>
      <span className="brand-mark" aria-hidden>
        <CliviaIcon className="brand-icon" />
      </span>
      <span className="brand-copy">
        <span className="brand-kicker">{kicker}</span>
        <span className="brand-name">{appName}</span>
      </span>
    </span>
  )
}
