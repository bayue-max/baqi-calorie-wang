const { calculateExerciseBurn, buildExerciseRecordName } = require('../cloudfunctions/shared/exercise')

describe('exercise calculations', () => {
  test('calculates moderate strength burn', () => {
    expect(calculateExerciseBurn({
      weight: 70,
      intensity: 'moderate_strength',
      duration: 45
    })).toBe(252)
  })

  test('builds display name with duration', () => {
    expect(buildExerciseRecordName('moderate_strength', 45)).toBe('中度力量训练 45min')
  })
})
