const MEAL_WORDS = ['早餐', '午餐', '晚餐', '加餐']
const UNIT_PATTERN = '(kg|千克|g|克|ml|个|根|份)'

function normalizeText(text) {
  return MEAL_WORDS.reduce((value, mealWord) => value.replaceAll(mealWord, ''), text)
    .replace(/，/g, ',')
    .replace(/、/g, ',')
    .replace(/；/g, ',')
    .replace(/;/g, ',')
    .trim()
}

function splitSegments(text) {
  const normalized = normalizeText(text)
  if (normalized.includes(',')) {
    return normalized.split(',').map(item => item.trim()).filter(Boolean)
  }
  return normalized
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function parseSegment(segment) {
  const prefixRegex = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${UNIT_PATTERN}\\s*(.+)$`)
  const prefixMatch = segment.match(prefixRegex)
  if (prefixMatch) {
    return {
      nameText: prefixMatch[3].trim(),
      amount: Number(prefixMatch[1]),
      unit: prefixMatch[2],
      isDefaultAmount: false
    }
  }

  const suffixRegex = new RegExp(`^(.+?)(\\d+(?:\\.\\d+)?)?\\s*${UNIT_PATTERN}?$`)
  const suffixMatch = segment.match(suffixRegex)
  if (!suffixMatch) {
    return { nameText: segment, amount: 100, unit: 'g', isDefaultAmount: true }
  }

  const nameText = suffixMatch[1].trim()
  const amount = suffixMatch[2] ? Number(suffixMatch[2]) : 100
  const unit = suffixMatch[3] || 'g'
  return {
    nameText,
    amount,
    unit,
    isDefaultAmount: !suffixMatch[2]
  }
}

function scoreFood(food, nameText) {
  if (!food.enabled) return 0
  if (food.name === nameText) return 100 + Number(food.priority || 0)
  if ((food.alias || []).includes(nameText)) return 90 + Number(food.priority || 0)
  if (food.name.includes(nameText) || nameText.includes(food.name)) return 70 + Number(food.priority || 0)
  if ((food.alias || []).some(alias => alias.includes(nameText) || nameText.includes(alias))) {
    return 60 + Number(food.priority || 0)
  }
  return 0
}

function findFood(foods, nameText) {
  const scored = foods
    .map(food => ({ food, score: scoreFood(food, nameText) }))
    .filter(item => item.score >= 60)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return null
  if (scored.length === 1) return scored[0].food
  if (scored[0].score - scored[1].score >= 10) return scored[0].food
  return null
}

function gramEquivalentFor(parsed, food) {
  if (parsed.unit === 'kg' || parsed.unit === '千克') return parsed.amount * 1000
  const conversions = food.unitConversions || {}
  const factor = conversions[parsed.unit]
  if (!factor) return null
  return parsed.amount * factor
}

function calculateNutrition(food, grams) {
  const ratio = grams / 100
  return {
    calories: Math.round(Number(food.caloriesPer100g) * ratio),
    protein: Math.round(Number(food.proteinPer100g) * ratio),
    fat: Math.round(Number(food.fatPer100g) * ratio),
    carb: Math.round(Number(food.carbPer100g) * ratio)
  }
}

function parseFoodInput(rawInput, foods) {
  const segments = splitSegments(rawInput)
  const items = []
  const failed = []

  segments.forEach(segment => {
    const parsed = parseSegment(segment)
    const food = findFood(foods, parsed.nameText)
    if (!food) {
      failed.push(parsed.nameText)
      return
    }

    const grams = gramEquivalentFor(parsed, food)
    if (!grams) {
      failed.push(parsed.nameText)
      return
    }

    items.push({
      foodId: food._id,
      name: food.name,
      rawSegment: segment,
      amount: parsed.amount,
      unit: parsed.unit,
      gramEquivalent: Math.round(grams),
      isDefaultAmount: parsed.isDefaultAmount,
      ...calculateNutrition(food, grams)
    })
  })

  return { items, failed }
}

module.exports = {
  parseFoodInput
}
