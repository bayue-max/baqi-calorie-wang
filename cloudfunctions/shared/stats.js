function buildStatsPoints(summaries, plan) {
  const baseTargetCalories = Math.round(Number(plan && plan.targetCalories) || 0)
  const baseTotalBurnCalories = Math.round(Number(plan && plan.tdee) || 0)
  return (summaries || []).map(item => {
    const exerciseBurn = Math.round(Number(item.exerciseBurn || 0))
    const dynamicTargetCalories = item.dynamicTargetCalories
      ? Math.round(Number(item.dynamicTargetCalories))
      : baseTargetCalories + exerciseBurn
    const totalBurnCalories = baseTotalBurnCalories + exerciseBurn

    return {
      date: item.date,
      foodCalories: Math.round(Number(item.foodCalories || 0)),
      dynamicTargetCalories,
      totalBurnCalories
    }
  })
}

module.exports = {
  buildStatsPoints
}
