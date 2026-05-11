const { EXERCISE_BURN_COEFFICIENT_MAP } = require('./constants')

const EXERCISE_LABEL_MAP = {
  cardio: '有氧',
  light_strength: '轻度力量训练',
  moderate_strength: '中度力量训练',
  heavy_strength: '重度力量训练'
}

function calculateExerciseBurn({ weight, intensity, duration }) {
  const coefficient = EXERCISE_BURN_COEFFICIENT_MAP[intensity]
  if (!coefficient) {
    throw new Error(`Unsupported exercise intensity: ${intensity}`)
  }
  return Math.round(coefficient * weight * duration)
}

function buildExerciseRecordName(intensity, duration) {
  const label = EXERCISE_LABEL_MAP[intensity]
  if (!label) {
    throw new Error(`Unsupported exercise intensity: ${intensity}`)
  }
  return `${label} ${duration}min`
}

module.exports = {
  calculateExerciseBurn,
  buildExerciseRecordName
}
