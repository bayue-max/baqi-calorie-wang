const { EXERCISE_BURN_COEFFICIENT_MAP } = require('./constants')

const EXERCISE_LABEL_MAP = {
  brisk_walk: '快走',
  elliptical: '椭圆机',
  cycling: '骑行',
  jogging: '慢跑',
  swimming: '游泳',
  treadmill_climb: '跑步机爬坡',
  hiit: 'HIIT',
  jump_rope: '跳绳',
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
