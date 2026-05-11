const MEAL_TYPES = [
  { label: '早餐', value: 'breakfast' },
  { label: '午餐', value: 'lunch' },
  { label: '晚餐', value: 'dinner' },
  { label: '加餐', value: 'snack' }
]

const EXERCISE_INTENSITIES = [
  { label: '有氧', value: 'cardio' },
  { label: '轻度力量', value: 'light_strength' },
  { label: '中度力量', value: 'moderate_strength' },
  { label: '重度力量', value: 'heavy_strength' }
]

const GOALS = [
  { label: '减脂', value: 'fat_loss' },
  { label: '维持', value: 'maintain' },
  { label: '增肌', value: 'muscle_gain' }
]

module.exports = {
  MEAL_TYPES,
  EXERCISE_INTENSITIES,
  GOALS
}
