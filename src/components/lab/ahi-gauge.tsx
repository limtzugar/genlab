'use client'

type Props = {
  autonomy: number
  ethics: number
  decentral: number
  score?: number
  size?: 'sm' | 'md' | 'lg'
  reasoning?: string
}

export function AhiGauge({ autonomy, ethics, decentral, size = 'md' }: Props) {
  const score = Math.round((autonomy + ethics + decentral) / 3)
  const dims = {
    sm: { ring: 64, label: 'text-[10px]', value: 'text-sm' },
    md: { ring: 96, label: 'text-xs', value: 'text-2xl' },
    lg: { ring: 140, label: 'text-sm', value: 'text-4xl' },
  }[size]

  const radius = dims.ring / 2 - 8
  const circ = 2 * Math.PI * radius
  const dash = (score / 100) * circ

  const color = score >= 80 ? 'var(--good)' : score >= 60 ? 'var(--warn)' : 'var(--bad)'

  const bars = [
    { label: 'Autonomiczność', value: autonomy, color: 'var(--good)' },
    { label: 'Etyka', value: ethics, color: 'var(--ahi)' },
    { label: 'Decentralizacja', value: decentral, color: 'var(--warn)' },
  ]

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: dims.ring, height: dims.ring }}>
        <svg width={dims.ring} height={dims.ring} className="-rotate-90">
          <circle
            cx={dims.ring / 2}
            cy={dims.ring / 2}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={6}
          />
          <motion.circle
            cx={dims.ring / 2}
            cy={dims.ring / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            initial={{ strokeDasharray: `0 ${circ}` }}
            animate={{ strokeDasharray: `${dash} ${circ}` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`font-semibold ${dims.value} font-mono`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ color }}
          >
            {score}
          </motion.span>
          <span className={`${dims.label} text-muted-foreground uppercase tracking-wider`}>AHI</span>
        </div>
      </div>

      <div className="flex-1 space-y-2 min-w-0">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">{b.label}</span>
              <span className="text-[11px] font-mono font-medium">{Math.round(b.value)}</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: b.color }}
                initial={{ width: 0 }}
                animate={{ width: `${b.value}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { motion } from 'framer-motion'
