function requireFields(input, fields) {
  fields.forEach(field => {
    const value = input[field]
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing required field: ${field}`)
    }
  })
}

function validateProfile(profile) {
  requireFields(profile, [
    'nickname',
    'gender',
    'age',
    'height',
    'weight',
    'goal'
  ])
}

function validatePositiveNumber(value, field) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    throw new Error(`${field} must be a positive number`)
  }
}

module.exports = {
  requireFields,
  validateProfile,
  validatePositiveNumber
}
