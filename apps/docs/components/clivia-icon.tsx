import type { ComponentPropsWithoutRef } from 'react'

import { cn } from '@/lib/cn'

type CliviaIconProps = Omit<ComponentPropsWithoutRef<'img'>, 'src'> & {
  title?: string
}

export function CliviaIcon({ alt, className, title, ...props }: CliviaIconProps) {
  const resolvedAlt = alt ?? title ?? ''

  return (
    <img
      src="/icon.svg"
      alt={resolvedAlt}
      aria-hidden={resolvedAlt ? undefined : true}
      className={cn('shrink-0', className)}
      {...props}
    />
  )
}
