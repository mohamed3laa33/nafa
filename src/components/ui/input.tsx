import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn('px-2 py-1 text-sm border rounded outline-none focus:ring-2 focus:ring-gray-300', className)} {...props} />
))
Input.displayName = 'Input'

