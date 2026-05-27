import { useState } from 'react'
import { CalcMode, Unit } from '@/types'
import { useUI } from '@/store/ui'

interface Props {
  unit: Unit
  onUpdateUnit: (u: Unit) => Promise<void>
  onUpdateName: (n: string) => Promise<void>
}

export function OnboardingSheet({ unit, onUpdateUnit, onUpdateName }: Props) {
  const { onboardingOpen, closeOnboarding, setCalcMode } = useUI()
  const [name, setName]       = useState('')
  const [mode, setMode]       = useState<CalcMode>('weight')
  const [saving, setSaving]   = useState(false)

  if (!onboardingOpen) return null

  async function handleStart() {
    setSaving(true)
    if (name.trim()) await onUpdateName(name.trim())
    setCalcMode(mode)
    setSaving(false)
    closeOnboarding()
  }

  return (
    <div className="sync-overlay show">
      <div className="sync-sheet onboarding-sheet">
        <div className="sync-header">
          <div className="sync-lock-ico">👋</div>
          <h2 className="sync-auth-title">Welcome to WeightCast!</h2>
          <p className="sync-auth-desc">Let's get your account set up — takes 10 seconds.</p>
        </div>

        <div className="onboarding-form">
          <label className="account-label">
            What's your first name? <span className="ob-optional">(optional)</span>
          </label>
          <input
            className="sync-input"
            placeholder="e.g. Alex"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleStart() }}
          />

          <label className="account-label ob-unit-label">Preferred units</label>
          <div className="acct-unit-toggle">
            {(['lbs', 'kg'] as Unit[]).map(u => (
              <button
                key={u}
                className={`acct-unit-btn${unit === u ? ' active' : ''}`}
                onClick={() => onUpdateUnit(u)}
              >{u}</button>
            ))}
          </div>

          <label className="account-label ob-unit-label">What's your focus?</label>
          <div className="mode-switch ob-mode-switch">
            <button className={`mode-btn${mode === 'weight' ? ' active' : ''}`} onClick={() => setMode('weight')}>
              <span className="mico">🎯</span>Goal Weight
              <span className="mode-sub">Set a target weight</span>
            </button>
            <button className={`mode-btn${mode === 'date' ? ' active' : ''}`} onClick={() => setMode('date')}>
              <span className="mico">📅</span>Target Date
              <span className="mode-sub">Set a deadline</span>
            </button>
          </div>

          <button className="sync-submit-btn ob-start-btn" onClick={handleStart} disabled={saving}>
            {saving ? 'Setting up…' : 'Get Started →'}
          </button>
          <button className="sync-mode-toggle" onClick={closeOnboarding}>Skip for now</button>
        </div>
      </div>
    </div>
  )
}
