function sum(records, field) {
  return records.reduce((total, record) => total + Number(record[field] || 0), 0)
}

function calculateDailySummary(records, userPlan) {
  const foodRecords = records.filter(record => record.recordType === 'food')
  const exerciseRecords = records.filter(record => record.recordType === 'exercise')

  const foodCalories = Math.round(sum(foodRecords, 'calories'))
  const proteinTotal = Math.round(sum(foodRecords, 'protein'))
  const fatTotal = Math.round(sum(foodRecords, 'fat'))
  const carbTotal = Math.round(sum(foodRecords, 'carb'))
  const exerciseBurn = Math.abs(Math.round(sum(exerciseRecords, 'calories')))
  const dynamicTargetCalories = Math.round(userPlan.targetCalories + exerciseBurn)
  const netCalories = Math.round(foodCalories - exerciseBurn)
  const dynamicProteinTarget = Math.round(userPlan.proteinTarget)
  const dynamicFatTarget = Math.round(userPlan.fatTarget)
  const dynamicCarbTarget = Math.round(
    (dynamicTargetCalories - dynamicProteinTarget * 4 - dynamicFatTarget * 9) / 4
  )

  return {
    bmr: Math.round(userPlan.bmr),
    targetCalories: Math.round(userPlan.targetCalories),
    exerciseBurn,
    dynamicTargetCalories,
    foodCalories,
    netCalories,
    proteinTotal,
    fatTotal,
    carbTotal,
    dynamicProteinTarget,
    dynamicFatTarget,
    dynamicCarbTarget,
    remainingCalories: Math.round(dynamicTargetCalories - foodCalories),
    remainingProtein: Math.round(dynamicProteinTarget - proteinTotal),
    remainingFat: Math.round(dynamicFatTarget - fatTotal),
    remainingCarb: Math.round(dynamicCarbTarget - carbTotal)
  }
}

module.exports = {
  calculateDailySummary
}
