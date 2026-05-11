const { calculateUserPlan } = require('../cloudfunctions/shared/plan')

describe('calculateUserPlan', () => {
  test('calculates male fat loss plan', () => {
    const plan = calculateUserPlan({
      gender: 'male',
      age: 30,
      height: 175,
      weight: 72.5,
      goal: 'fat_loss'
    })

    expect(plan).toEqual({
      bmr: 1674,
      activityFactor: 1.2,
      tdee: 2009,
      dailyActivityBurn: 335,
      habitBurn: 335,
      goal: 'fat_loss',
      calorieAdjustment: -350,
      targetCalories: 1659,
      proteinTarget: 145,
      fatTarget: 46,
      carbTarget: 166
    })
  })

  test('calculates female maintain plan', () => {
    const plan = calculateUserPlan({
      gender: 'female',
      age: 28,
      height: 165,
      weight: 58,
      goal: 'maintain'
    })

    expect(plan.bmr).toBe(1310)
    expect(plan.tdee).toBe(1572)
    expect(plan.targetCalories).toBe(1572)
    expect(plan.proteinTarget).toBe(93)
    expect(plan.fatTarget).toBe(44)
    expect(plan.carbTarget).toBe(202)
  })
})
