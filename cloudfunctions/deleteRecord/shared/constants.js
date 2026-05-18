const DAILY_ACTIVITY_FACTOR = 1.2

const GOAL_ADJUSTMENT_MAP = {
  fat_loss: -350,
  maintain: 0,
  muscle_gain: 250
}

const PROTEIN_FACTOR_MAP = {
  fat_loss: 2.0,
  maintain: 1.6,
  muscle_gain: 1.8
}

const EXERCISE_BURN_COEFFICIENT_MAP = {
  brisk_walk: 0.06,
  elliptical: 0.08,
  cycling: 0.11,
  jogging: 0.13,
  swimming: 0.13,
  treadmill_climb: 0.15,
  hiit: 0.16,
  jump_rope: 0.19,
  light_strength: 0.04,
  moderate_strength: 0.05,
  heavy_strength: 0.07
}

module.exports = {
  DAILY_ACTIVITY_FACTOR,
  GOAL_ADJUSTMENT_MAP,
  PROTEIN_FACTOR_MAP,
  EXERCISE_BURN_COEFFICIENT_MAP
}
