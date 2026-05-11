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
  cardio: 0.09,
  light_strength: 0.06,
  moderate_strength: 0.08,
  heavy_strength: 0.1
}

module.exports = {
  DAILY_ACTIVITY_FACTOR,
  GOAL_ADJUSTMENT_MAP,
  PROTEIN_FACTOR_MAP,
  EXERCISE_BURN_COEFFICIENT_MAP
}
