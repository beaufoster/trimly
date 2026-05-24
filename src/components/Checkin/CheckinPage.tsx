import { useState } from 'react'
import { User } from '@supabase/supabase-js'
import { Checkin, Plan, Unit } from '@/types'
import { useUI } from '@/store/ui'
import { DEMO_NAME } from '@/lib/demoData'
import { ph } from '@/lib/analytics'
import { fmtWt } from '@/utils/calculator'
import { calcStreakFromEntries } from '@/utils/streak'
import { CheckinForm } from './CheckinForm'
import { CheckinList } from './CheckinList'
import { CheckinChart } from './CheckinChart'
import { ProgressSnapshot } from './ProgressSnapshot'

interface Props {
  user: User | null
  plan: Plan | null
  checkins: Checkin[]
  unit: Unit
  onAdd: (entry: Omit<Checkin, 'id'> & { id?: number }) => Promise<Checkin>
  onDelete: (date: string) => Promise<void>
}

const MILESTONE_WEIGHTS = [4, 8, 13, 26, 52]

function calcPaceStatus(plan: Plan, checkins: Checkin[]): { label: string; cls: string } | null {
  if (!plan.savedAt || !plan.sim.length || !checkins.length) return null
  const savedMs = new Date(plan.savedAt).getTime()
  const weeksSince = (Date.now() - savedMs) / (7 * 24 * 3600 * 1000)
  if (weeksSince < 1) return null
  const weekIdx = Math.min(Math.floor(weeksSince) - 1, plan.sim.length - 1)
  const projected = plan.sim[weekIdx].weight
  const sorted    = [...checkins].sort((a, b) => b.date.localeCompare(a.date))
  const actual    = sorted[0].weight
  const diff      = projected - actual // positive = ahead (lost more than planned)
  if (diff > 2)   return { label: '🟢 Ahead of pace',   cls: 'pace-status ahead' }
  if (diff >= -1) return { label: '✅ On pace',           cls: 'pace-status on'    }
  return           { label: '⚠️ Behind pace',            cls: 'pace-status behind' }
}

export function CheckinPage({ user, plan, checkins, unit, onAdd, onDelete }: Props) {
  const { editId, setEditId, showToast, queueCelebration, openSyncSheet } = useUI()
  const [celebratedMilestones, setCelebratedMilestones] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('tr_celebrated') || '[]') } catch { return [] }
  })

  const sorted     = [...checkins].sort((a, b) => a.date.localeCompare(b.date))
  const latest     = sorted[sorted.length - 1]
  const streak     = calcStreakFromEntries(checkins)
  const paceStatus = plan ? calcPaceStatus(plan, checkins) : null

  async function handleSubmit(date: string, weight: number, note: string) {
    if (!user) { openSyncSheet('signup'); return }

    const editingCheckin = editId != null ? checkins.find(c => c.id === editId) : null

    if (!editingCheckin && checkins.some(c => c.date === date)) {
      showToast('You already have a check-in for this date.')
      return
    }

    try {
      const entry: Omit<Checkin, 'id'> & { id?: number } = {
        ...(editingCheckin ? { id: editingCheckin.id } : {}),
        date, weight, note,
      }
      await onAdd(entry)
      setEditId(null)
      checkMilestones(weight)
      ph.capture('checkin_logged', { is_edit: !!editingCheckin })
      showToast(editingCheckin ? 'Check-in updated.' : 'Check-in saved!')
    } catch {
      showToast('Could not save. Your check-in is stored locally.')
    }
  }

  function checkMilestones(newWeight: number) {
    if (!plan) return
    const newStreak = calcStreakFromEntries([...checkins, { id: 0, date: '', weight: newWeight, note: '' }])

    // Weight milestones at 10%, 20%, ... of goal
    const totalLoss = plan.cw - plan.gw
    if (totalLoss > 0) {
      [0.1, 0.25, 0.5, 0.75, 1].forEach(pct => {
        const target = plan.cw - totalLoss * pct
        const key = `loss_${pct}`
        if (newWeight <= target && !celebratedMilestones.includes(key)) {
          const label = pct === 1 ? 'Goal reached!' : `${Math.round(pct * 100)}% of goal`
          queueCelebration('🎉', label, fmtWt(totalLoss * pct, unit) + ' lost!')
          const next = [...celebratedMilestones, key]
          setCelebratedMilestones(next)
          localStorage.setItem('tr_celebrated', JSON.stringify(next))
        }
      })
    }

    // Streak milestones
    MILESTONE_WEIGHTS.forEach(w => {
      const key = `streak_${w}`
      if (newStreak >= w && !celebratedMilestones.includes(key)) {
        queueCelebration('🔥', `${w}-Week Streak!`, 'Consistency is your superpower.')
        const next = [...celebratedMilestones, key]
        setCelebratedMilestones(next)
        localStorage.setItem('tr_celebrated', JSON.stringify(next))
      }
    })
  }

  const isDemo = !user

  return (
    <div className="page page-checkin active">
      <div className="ci-page-hero">
        <h1>{isDemo ? `${DEMO_NAME}'s Check‑In` : 'Weekly Check‑In'}</h1>
        <div className="ci-hero-badges">
          <div className="streak-badge">
            {streak > 0 ? `🔥 ${streak}-week streak` : 'Log your weight weekly'}
          </div>
          {paceStatus && <div className={paceStatus.cls}>{paceStatus.label}</div>}
        </div>
      </div>

      <div className="cards-wrap">
        {isDemo && (
          <div className="banner demo-banner" style={{ marginBottom: 16 }}>
            <span className="bico">👀</span>
            <div>
              <strong>You're viewing demo data.</strong>{' '}
              <button className="demo-signup-link" onClick={() => openSyncSheet('signup')}>
                Create a free account
              </button>{' '}
              to track your own progress.
            </div>
          </div>
        )}

        <ProgressSnapshot plan={plan} checkins={sorted} unit={unit} />

        <CheckinForm
          editId={editId}
          checkins={checkins}
          unit={unit}
          latestWeight={latest?.weight ?? plan?.cw ?? null}
          onSubmit={handleSubmit}
          onCancelEdit={() => setEditId(null)}
        />

        {checkins.length >= 3 && (
          <CheckinChart checkins={sorted} plan={plan} unit={unit} />
        )}

        <CheckinList
          checkins={sorted}
          unit={unit}
          plan={plan}
          editId={editId}
          onEdit={isDemo ? () => openSyncSheet('signup') : setEditId}
          onDelete={isDemo ? async () => { openSyncSheet('signup') } : onDelete}
        />
      </div>
    </div>
  )
}
