const { calculateDailySummary } = require('../cloudfunctions/shared/summary')

describe('calculateDailySummary', () => {
  const userPlan = {
    bmr: 1650,
    targetCalories: 1975,
    proteinTarget: 145,
    fatTarget: 55,
    carbTarget: 210
  }

  test('summarizes food and exercise records', () => {
    const records = [
      { recordType: 'food', calories: 240, protein: 46, fat: 5, carb: 0 },
      { recordType: 'food', calories: 174, protein: 4, fat: 0, carb: 39 },
      { recordType: 'exercise', calories: -252, protein: 0, fat: 0, carb: 0 }
    ]

    expect(calculateDailySummary(records, userPlan)).toEqual({
      bmr: 1650,
      targetCalories: 1975,
      exerciseBurn: 252,
      dynamicTargetCalories: 2227,
      foodCalories: 414,
      netCalories: 162,
      proteinTotal: 50,
      fatTotal: 5,
      carbTotal: 39,
      dynamicProteinTarget: 145,
      dynamicFatTarget: 55,
      dynamicCarbTarget: 288,
      remainingCalories: 1813,
      remainingProtein: 95,
      remainingFat: 50,
      remainingCarb: 249
    })
  })
})
