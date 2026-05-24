import { Checkin, Plan } from '@/types'

export const DEMO_NAME = 'Alex'

// Anchored to "4 weeks ago" so the chart and pace badge render meaningfully
const SAVED_AT = new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString()

function weeksAgoDate(n: number): string {
  return new Date(Date.now() - n * 7 * 24 * 3600 * 1000).toISOString().split('T')[0]
}

export const DEMO_PLAN: Plan = {
  cw: 195,
  gw: 175,
  startWt: 195,
  sim: [
    { week:  1, weight: 193.5 }, { week:  2, weight: 192.1 },
    { week:  3, weight: 190.7 }, { week:  4, weight: 189.3 },
    { week:  5, weight: 188.0 }, { week:  6, weight: 186.7 },
    { week:  7, weight: 185.5 }, { week:  8, weight: 184.3 },
    { week:  9, weight: 183.1 }, { week: 10, weight: 182.0 },
    { week: 11, weight: 180.9 }, { week: 12, weight: 179.9 },
    { week: 13, weight: 178.9 }, { week: 14, weight: 177.9 },
    { week: 15, weight: 177.0 }, { week: 16, weight: 176.1 },
    { week: 17, weight: 175.3 }, { week: 18, weight: 175.0 },
  ],
  cal: 1800,
  exPerDay: 200,
  goalDate: new Date(Date.now() + 14 * 7 * 24 * 3600 * 1000).toISOString(),
  savedAt: SAVED_AT,
  mode: 'weight',
  age: 32,
  htFt: 5, htIn: 10, htCm: 178,
  sex: 'male',
  act: 2,
  walk: 30, lift: 2, cardio: 1,
  pace: 'steady',
}

export const DEMO_CHECKINS: Checkin[] = [
  { id: -1, date: weeksAgoDate(4), weight: 195.0, note: '' },
  { id: -2, date: weeksAgoDate(3), weight: 193.4, note: '' },
  { id: -3, date: weeksAgoDate(2), weight: 191.8, note: 'Feeling good!' },
  { id: -4, date: weeksAgoDate(1), weight: 190.2, note: '' },
]
