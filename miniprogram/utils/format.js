function kcal(value) {
  return `${Math.round(Number(value || 0))} kcal`
}

function gram(value) {
  return `${Math.round(Number(value || 0))}g`
}

function signedKcal(value) {
  const rounded = Math.round(Number(value || 0))
  return rounded > 0 ? `+${rounded} kcal` : `${rounded} kcal`
}

module.exports = {
  kcal,
  gram,
  signedKcal
}
