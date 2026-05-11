const {
  DAILY_ACTIVITY_FACTOR,
  GOAL_ADJUSTMENT_MAP,
  PROTEIN_FACTOR_MAP
} = require('./constants')

function calculateBmr(profile) {
  const { gender, age, height, weight } = profile
  const offset = gender === 'male' ? 5 : -161
  return 10 * weight + 6.25 * height - 5 * age + offset
}

function calculateUserPlan(profile) {
  const { goal, weight } = profile
  const bmrRaw = calculateBmr(profile)
  const activityFactor = DAILY_ACTIVITY_FACTOR
  const calorieAdjustment = GOAL_ADJUSTMENT_MAP[goal]
  const proteinFactor = PROTEIN_FACTOR_MAP[goal]

  if (calorieAdjustment === undefined) {
    throw new Error(`Unsupported goal: ${goal}`)
  }
  if (!proteinFactor) {
    throw new Error(`Unsupported protein goal: ${goal}`)
  }

  const tdeeRaw = bmrRaw * activityFactor
  const targetCaloriesRaw = tdeeRaw + calorieAdjustment
  const proteinTargetRaw = weight * proteinFactor
  const fatTargetRaw = targetCaloriesRaw * 0.25 / 9
  const carbTargetRaw = (targetCaloriesRaw - proteinTargetRaw * 4 - fatTargetRaw * 9) / 4

  return {
    bmr: Math.round(bmrRaw),
    activityFactor,
    tdee: Math.round(tdeeRaw),
    dailyActivityBurn: Math.round(tdeeRaw - bmrRaw),
    habitBurn: Math.round(tdeeRaw - bmrRaw),
    goal,
    calorieAdjustment,
    targetCalories: Math.round(targetCaloriesRaw),
    proteinTarget: Math.round(proteinTargetRaw),
    fatTarget: Math.round(fatTargetRaw),
    carbTarget: Math.round(carbTargetRaw)
  }
}

module.exports = {
  calculateBmr,
  calculateUserPlan
}
