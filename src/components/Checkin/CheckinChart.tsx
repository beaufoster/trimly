import { useEffect, useRef } from 'react'
import { Checkin, Plan, Unit } from '@/types'
import { fromLbs, fmtWt } from '@/utils/calculator'

interface Props { checkins: Checkin[]; plan: Plan | null; unit: Unit }

export function CheckinChart({ checkins, plan, unit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || checkins.length < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const parent = canvas.parentElement!
    const cs = getComputedStyle(parent)
    canvas.width  = parent.offsetWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) || 340
    canvas.height = 220

    const W = canvas.width, H = canvas.height
    const pad = { top: 24, right: 16, bottom: 36, left: 52 }

    // Build projected points from plan sim (date-aligned)
    const savedMs  = plan?.savedAt ? new Date(plan.savedAt).getTime() : null
    const projPts: Array<{ ms: number; weight: number }> = []
    if (plan && savedMs) {
      projPts.push({ ms: savedMs, weight: plan.cw })
      plan.sim.forEach(s => {
        projPts.push({ ms: savedMs + s.week * 7 * 24 * 3600 * 1000, weight: s.weight })
      })
    }

    // X-axis: date-based, spanning actual check-ins ± some buffer
    const ciMs = checkins.map(c => new Date(c.date).getTime())
    const allMs = [...ciMs, ...projPts.map(p => p.ms)]
    const minMs = Math.min(...allMs)
    const maxMs = Math.max(...allMs)
    const span  = Math.max(maxMs - minMs, 7 * 24 * 3600 * 1000) // at least 1 week
    const xFromMs = (ms: number) =>
      pad.left + ((ms - minMs) / span) * (W - pad.left - pad.right)

    // Y-axis: all weights
    const actualWts = checkins.map(c => c.weight)
    const projWts   = projPts.map(p => p.weight)
    const goalWt    = plan?.gw ?? null
    const allWts    = [...actualWts, ...projWts, ...(goalWt != null ? [goalWt] : [])]
    const minW = Math.min(...allWts) - 3
    const maxW = Math.max(...allWts) + 3
    const yP = (w: number) => H - pad.bottom - (w - minW) / (maxW - minW) * (H - pad.top - pad.bottom)

    ctx.clearRect(0, 0, W, H)

    // Goal line (very subtle)
    if (goalWt != null) {
      ctx.beginPath(); ctx.strokeStyle = '#22a05a30'; ctx.lineWidth = 1; ctx.setLineDash([4, 6])
      ctx.moveTo(pad.left, yP(goalWt)); ctx.lineTo(W - pad.right, yP(goalWt)); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#22a05a88'; ctx.font = '10px DM Sans,sans-serif'; ctx.textAlign = 'left'
      ctx.fillText('Goal ' + fmtWt(goalWt, unit), pad.left + 4, yP(goalWt) - 4)
    }

    // Projected line (dashed, muted green)
    if (projPts.length > 1) {
      ctx.beginPath(); ctx.strokeStyle = '#22a05a55'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4])
      projPts.forEach((p, i) => {
        const x = xFromMs(p.ms), y = yP(p.weight)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke(); ctx.setLineDash([])
      // Label at plan start
      ctx.fillStyle = '#22a05a88'; ctx.font = '10px DM Sans,sans-serif'; ctx.textAlign = 'left'
      ctx.fillText('Projected', xFromMs(projPts[0].ms) + 4, yP(projPts[0].weight) - 6)
    }

    // Actual line (solid)
    ctx.beginPath(); ctx.strokeStyle = '#1a6b42'; ctx.lineWidth = 2.5
    checkins.forEach((c, i) => {
      const x = xFromMs(new Date(c.date).getTime()), y = yP(c.weight)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Dots on actual
    checkins.forEach(c => {
      ctx.beginPath()
      ctx.arc(xFromMs(new Date(c.date).getTime()), yP(c.weight), 4, 0, Math.PI * 2)
      ctx.fillStyle = '#1a6b42'; ctx.fill()
    })

    // X labels (dates)
    ctx.fillStyle = '#999'; ctx.font = '10px DM Sans,sans-serif'; ctx.textAlign = 'center'
    const step = Math.ceil(checkins.length / 5)
    checkins.forEach((c, i) => {
      if (i % step === 0 || i === checkins.length - 1)
        ctx.fillText(c.date.slice(5), xFromMs(new Date(c.date).getTime()), H - 10)
    })

    // Y labels
    ctx.textAlign = 'right'
    for (let k = 0; k <= 4; k++) {
      const w = minW + (maxW - minW) * (k / 4)
      ctx.fillText(fromLbs(w, unit).toFixed(0), pad.left - 4, yP(w) + 3)
    }
  }, [checkins, plan, unit])

  return (
    <div className="card ci-chart-card">
      <div className="card-title">
        <div className="ico">📈</div> Progress Chart
        <span className="chart-legend">
          <span className="legend-actual" />Actual
          <span className="legend-proj" />Projected
        </span>
      </div>
      <canvas ref={canvasRef} />
    </div>
  )
}
