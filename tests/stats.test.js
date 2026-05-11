const { buildStatsPoints } = require('../cloudfunctions/shared/stats')

describe('stats helpers', () => {
  test('adds daily suggested intake and total burn to trend points', () => {
    const plan = { targetCalories: 1659, tdee: 2009 }
    const summaries = [
      { date: '2026-05-03', foodCalories: 789, exerciseBurn: 0 },
      { date: '2026-05-04', foodCalories: 1200, exerciseBurn: 300 },
      { date: '2026-05-05', foodCalories: 900, exerciseBurn: 441 }
    ]

    expect(buildStatsPoints(summaries, plan)).toEqual([
      { date: '2026-05-03', foodCalories: 789, dynamicTargetCalories: 1659, totalBurnCalories: 2009 },
      { date: '2026-05-04', foodCalories: 1200, dynamicTargetCalories: 1959, totalBurnCalories: 2309 },
      { date: '2026-05-05', foodCalories: 900, dynamicTargetCalories: 2100, totalBurnCalories: 2450 }
    ])
  })
})
