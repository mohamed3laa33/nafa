import * as React from 'react'
import { cn } from '@/lib/utils'

export function Tabs({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
export function TabsList({ children }: { children: React.ReactNode }) {
  return <div className="inline-flex rounded border overflow-hidden">{children}</div>
}
export function TabsTrigger({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('px-3 py-1 text-sm', active ? 'bg-black text-white' : 'bg-white')}>{children}</button>
  )
}

