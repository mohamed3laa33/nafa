import * as React from 'react'
import { cn } from '@/lib/utils'

export function Badge({ variant = 'default', className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'success' | 'warning' | 'destructive' | 'muted' }) {
  const variants: Record<string, string> = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-800',
    destructive: 'bg-red-100 text-red-800',
    muted: 'bg-gray-50 text-gray-600',
  }
  return <span className={cn('inline-flex items-center px-2 py-0.5 text-xs rounded', variants[variant], className)} {...props} />
}

