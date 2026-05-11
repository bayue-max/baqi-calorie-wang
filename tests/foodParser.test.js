const { parseFoodInput, parseSegment, findFood, extractChineseQuantifier, tryRuleEngine, tryCookingMatch, resolveSegment } = require('../cloudfunctions/shared/foodParser')
const { detectCookingMethod, extractBaseFoodName, calculateOilCalories } = require('../cloudfunctions/shared/cookingMethods')

const foods = [
  {
    _id: 'chicken',
    name: '鸡胸肉',
    alias: ['鸡胸', '鸡肉', '白肉', '鸡脯肉'],
    state: 'raw',
    defaultWeight: 200,
    caloriesPer100g: 120,
    proteinPer100g: 23,
    fatPer100g: 2.5,
    carbPer100g: 0,
    unitConversions: { g: 1, 克: 1, 份: 100 },
    priority: 10,
    enabled: true
  },
  {
    _id: 'rice',
    name: '米饭',
    alias: ['白米饭', '饭', '大米饭', '白饭'],
    state: 'cooked',
    defaultWeight: 150,
    caloriesPer100g: 116,
    proteinPer100g: 2.6,
    fatPer100g: 0.3,
    carbPer100g: 25.9,
    unitConversions: { g: 1, 克: 1, 份: 150, 碗: 150 },
    priority: 10,
    enabled: true
  },
  {
    _id: 'egg',
    name: '鸡蛋',
    alias: ['蛋', '全蛋', '鸡蛋黄'],
    state: 'standard',
    defaultWeight: 50,
    caloriesPer100g: 140,
    proteinPer100g: 12,
    fatPer100g: 10,
    carbPer100g: 1,
    unitConversions: { g: 1, 克: 1, 个: 50 },
    priority: 10,
    enabled: true
  },
  {
    _id: 'broccoli',
    name: '西兰花',
    alias: ['绿花菜', '青花菜', '花椰菜'],
    state: 'cooked',
    defaultWeight: 100,
    caloriesPer100g: 35,
    proteinPer100g: 2.4,
    fatPer100g: 0.4,
    carbPer100g: 7,
    unitConversions: { g: 1, 克: 1, 份: 100 },
    priority: 8,
    enabled: true
  }
]

// ══════════════════════════════════════════════
//  Layer 0: Unit-level function tests
// ══════════════════════════════════════════════

describe('extractChineseQuantifier', () => {
  test('parses "一碗米饭"', () => {
    expect(extractChineseQuantifier('一碗米饭')).toEqual({
      matched: true, amount: 1, unit: '碗', foodName: '米饭', rawQuantifier: '一碗'
    })
  })

  test('parses "两个鸡蛋"', () => {
    const result = extractChineseQuantifier('两个鸡蛋')
    expect(result.matched).toBe(true)
    expect(result.amount).toBe(2)
    expect(result.unit).toBe('个')
    expect(result.foodName).toBe('鸡蛋')
  })

  test('parses "半碗米饭"', () => {
    const result = extractChineseQuantifier('半碗米饭')
    expect(result.matched).toBe(true)
    expect(result.amount).toBe(0.5)
    expect(result.unit).toBe('碗')
    expect(result.foodName).toBe('米饭')
  })

  test('parses "三份麻婆豆腐"', () => {
    const result = extractChineseQuantifier('三份麻婆豆腐')
    expect(result.matched).toBe(true)
    expect(result.amount).toBe(3)
    expect(result.unit).toBe('份')
    expect(result.foodName).toBe('麻婆豆腐')
  })

  test('returns false for "鸡胸肉200g" (no Chinese quantifier)', () => {
    expect(extractChineseQuantifier('鸡胸肉200g')).toEqual({ matched: false })
  })

  test('returns false for "炒西兰花" (cooking prefix, not quantifier)', () => {
    expect(extractChineseQuantifier('炒西兰花')).toEqual({ matched: false })
  })
})

describe('detectCookingMethod', () => {
  test('detects "炒" in "炒西兰花"', () => {
    const result = detectCookingMethod('炒西兰花')
    expect(result).not.toBeNull()
    expect(result.method).toBe('炒')
  })

  test('detects "清蒸" in "清蒸鲈鱼"', () => {
    const result = detectCookingMethod('清蒸鲈鱼')
    expect(result.method).toBe('蒸')
  })

  test('detects "红烧" in "红烧肉"', () => {
    const result = detectCookingMethod('红烧肉')
    expect(result.method).toBe('红烧')
  })

  test('returns null for "鸡胸肉" (no cooking method)', () => {
    expect(detectCookingMethod('鸡胸肉')).toBeNull()
  })
})

describe('extractBaseFoodName', () => {
  test('strips "炒" from "炒西兰花"', () => {
    const method = detectCookingMethod('炒西兰花')
    expect(extractBaseFoodName('炒西兰花', method)).toBe('西兰花')
  })

  test('strips "清蒸" from "清蒸鲈鱼"', () => {
    const method = detectCookingMethod('清蒸鲈鱼')
    expect(extractBaseFoodName('清蒸鲈鱼', method)).toBe('鲈鱼')
  })
})

describe('calculateOilCalories', () => {
  test('炒 adds 90 kcal (10g × 9)', () => {
    const method = detectCookingMethod('炒西兰花')
    expect(calculateOilCalories(method.config)).toBe(90)
  })

  test('炸 adds 225 kcal (25g × 9)', () => {
    const method = detectCookingMethod('油炸鸡排')
    expect(calculateOilCalories(method.config)).toBe(225)
  })

  test('蒸 adds 0 kcal', () => {
    const method = detectCookingMethod('清蒸鲈鱼')
    expect(calculateOilCalories(method.config)).toBe(0)
  })
})

// ══════════════════════════════════════════════
//  Layer 1: Rule engine tests
// ══════════════════════════════════════════════

describe('tryRuleEngine', () => {
  test('matches exact name with suffix weight', () => {
    const result = tryRuleEngine('鸡胸肉200g', foods)
    expect(result).not.toBeNull()
    expect(result.name).toBe('鸡胸肉')
    expect(result.gramEquivalent).toBe(200)
    expect(result.calories).toBe(240)
    expect(result.isDefaultAmount).toBe(false)
  })

  test('matches alias with prefix weight', () => {
    const result = tryRuleEngine('200g鸡肉', foods)
    expect(result).not.toBeNull()
    expect(result.name).toBe('鸡胸肉')
    expect(result.gramEquivalent).toBe(200)
  })

  test('matches Chinese quantifier "一碗米饭"', () => {
    const result = tryRuleEngine('一碗米饭', foods)
    expect(result).not.toBeNull()
    expect(result.name).toBe('米饭')
    expect(result.amount).toBe(1)
    expect(result.unit).toBe('碗')
    expect(result.gramEquivalent).toBe(150) // 碗:150g × 1
    expect(result.isDefaultAmount).toBe(false)
  })

  test('matches Chinese quantifier "两个鸡蛋"', () => {
    const result = tryRuleEngine('两个鸡蛋', foods)
    expect(result).not.toBeNull()
    expect(result.name).toBe('鸡蛋')
    expect(result.amount).toBe(2)
    expect(result.unit).toBe('个')
    expect(result.gramEquivalent).toBe(100) // 个:50g × 2
  })

  test('uses defaultWeight when no amount specified', () => {
    const result = tryRuleEngine('鸡胸', foods)
    expect(result).not.toBeNull()
    expect(result.name).toBe('鸡胸肉')
    expect(result.gramEquivalent).toBe(200) // defaultWeight = 200
    expect(result.isDefaultAmount).toBe(true)
  })

  test('uses defaultWeight for pure name match "米饭"', () => {
    const result = tryRuleEngine('米饭', foods)
    expect(result).not.toBeNull()
    expect(result.name).toBe('米饭')
    expect(result.gramEquivalent).toBe(150) // defaultWeight = 150
  })

  test('returns null for unknown food', () => {
    expect(tryRuleEngine('螺蛳粉', foods)).toBeNull()
  })

  test('returns null for unknown food with weight', () => {
    expect(tryRuleEngine('螺蛳粉350g', foods)).toBeNull()
  })
})

// ══════════════════════════════════════════════
//  Layer 2: Cooking method tests
// ══════════════════════════════════════════════

describe('tryCookingMatch', () => {
  test('resolves "炒西兰花" with oil calories', () => {
    const result = tryCookingMatch('炒西兰花', foods)
    expect(result).not.toBeNull()
    expect(result.name).toBe('西兰花')
    expect(result.cookingMethod).toBe('炒')
    expect(result.oilCalories).toBe(90) // 10g × 9
    expect(result.gramEquivalent).toBe(100) // defaultWeight
    // 西兰花: 35kcal/100g + 油 90kcal = 125kcal
    expect(result.calories).toBe(125)
  })

  test('resolves "清蒸西兰花" (no oil)', () => {
    const result = tryCookingMatch('清蒸西兰花', foods)
    expect(result).not.toBeNull()
    expect(result.name).toBe('西兰花')
    expect(result.cookingMethod).toBe('蒸')
    expect(result.oilCalories).toBeUndefined()
    expect(result.calories).toBe(35) // 西兰花 only
  })

  test('returns null for cooking method with no matching food', () => {
    expect(tryCookingMatch('炒螺蛳粉', foods)).toBeNull()
  })

  test('returns null for text with no cooking method', () => {
    expect(tryCookingMatch('鸡胸肉', foods)).toBeNull()
  })
})

// ══════════════════════════════════════════════
//  Integration: parseFoodInput
// ══════════════════════════════════════════════

describe('parseFoodInput - backward compatibility', () => {
  test('parses multiple foods with units', () => {
    const result = parseFoodInput('鸡胸肉200g，米饭150g，鸡蛋2个', foods)

    expect(result.failed).toEqual([])
    expect(result.items.map(item => ({
      name: item.name,
      amount: item.amount,
      unit: item.unit,
      gramEquivalent: item.gramEquivalent,
      calories: item.calories
    }))).toEqual([
      { name: '鸡胸肉', amount: 200, unit: 'g', gramEquivalent: 200, calories: 240 },
      { name: '米饭', amount: 150, unit: 'g', gramEquivalent: 150, calories: 174 },
      { name: '鸡蛋', amount: 2, unit: '个', gramEquivalent: 100, calories: 140 }
    ])
  })

  test('parses quantity before and after food names', () => {
    const prefixResult = parseFoodInput('2个鸡蛋，300克米饭', foods)
    const suffixResult = parseFoodInput('鸡蛋2个，米饭300克', foods)

    const compact = result => result.items.map(item => ({
      name: item.name,
      amount: item.amount,
      unit: item.unit,
      gramEquivalent: item.gramEquivalent,
      isDefaultAmount: item.isDefaultAmount
    }))

    expect(prefixResult.failed).toEqual([])
    expect(compact(prefixResult)).toEqual([
      { name: '鸡蛋', amount: 2, unit: '个', gramEquivalent: 100, isDefaultAmount: false },
      { name: '米饭', amount: 300, unit: '克', gramEquivalent: 300, isDefaultAmount: false }
    ])

    expect(suffixResult.failed).toEqual([])
    expect(compact(suffixResult)).toEqual(compact(prefixResult))
  })

  test('uses defaultWeight when amount is missing', () => {
    const result = parseFoodInput('鸡胸', foods)
    expect(result.items[0].name).toBe('鸡胸肉')
    expect(result.items[0].isDefaultAmount).toBe(true)
    expect(result.items[0].gramEquivalent).toBe(200) // was 100, now 200 (defaultWeight)
  })

  test('ignores meal words and reports unknown foods', () => {
    const result = parseFoodInput('午餐鸡胸肉200g，未知食物100g', foods)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].name).toBe('鸡胸肉')
    expect(result.failed).toEqual(['未知食物100g'])
  })
})

describe('parseFoodInput - new three-layer features', () => {
  test('parses Chinese quantifier "一碗米饭"', () => {
    const result = parseFoodInput('一碗米饭', foods)
    expect(result.failed).toEqual([])
    expect(result.items[0].name).toBe('米饭')
    expect(result.items[0].unit).toBe('碗')
    expect(result.items[0].gramEquivalent).toBe(150)
  })

  test('parses Chinese quantifier "两个鸡蛋"', () => {
    const result = parseFoodInput('两个鸡蛋', foods)
    expect(result.failed).toEqual([])
    expect(result.items[0].name).toBe('鸡蛋')
    expect(result.items[0].amount).toBe(2)
    expect(result.items[0].unit).toBe('个')
    expect(result.items[0].gramEquivalent).toBe(100)
  })

  test('parses cooking method "炒西兰花" with oil (calories + fat)', () => {
    const result = parseFoodInput('炒西兰花', foods)
    expect(result.failed).toEqual([])
    expect(result.items[0].name).toBe('西兰花')
    expect(result.items[0].cookingMethod).toBe('炒')
    expect(result.items[0].oilCalories).toBe(90)
    // 西兰花 35kcal + 油 90kcal = 125kcal
    expect(result.items[0].calories).toBe(125)
    // 油 10g = 10g 脂肪
    expect(result.items[0].fat).toBe(10)
  })

  test('parses "清蒸西兰花" without oil', () => {
    const result = parseFoodInput('清蒸西兰花', foods)
    expect(result.failed).toEqual([])
    expect(result.items[0].name).toBe('西兰花')
    expect(result.items[0].cookingMethod).toBe('蒸')
    expect(result.items[0].oilCalories).toBeUndefined()
    expect(result.items[0].calories).toBe(35)
  })

  test('mixed input: rule + quantifier + cooking', () => {
    const result = parseFoodInput('鸡胸肉200g，一碗米饭，炒西兰花', foods)
    expect(result.failed).toEqual([])
    expect(result.items).toHaveLength(3)

    // Layer 1 (suffix): 鸡胸肉200g
    expect(result.items[0].name).toBe('鸡胸肉')
    expect(result.items[0].gramEquivalent).toBe(200)
    expect(result.items[0].calories).toBe(240)

    // Layer 1 (quantifier): 一碗米饭
    expect(result.items[1].name).toBe('米饭')
    expect(result.items[1].unit).toBe('碗')
    expect(result.items[1].gramEquivalent).toBe(150)

    // Layer 2 (cooking): 炒西兰花
    expect(result.items[2].name).toBe('西兰花')
    expect(result.items[2].cookingMethod).toBe('炒')
    expect(result.items[2].oilCalories).toBe(90)
    expect(result.items[2].calories).toBe(125)
  })

  test('reports unknown cooking method food as failed', () => {
    const result = parseFoodInput('炒未知食物', foods)
    expect(result.items).toHaveLength(0)
    expect(result.failed).toEqual(['炒未知食物'])
  })

  test('reports unknown food as failed', () => {
    const result = parseFoodInput('螺蛳粉', foods)
    expect(result.items).toHaveLength(0)
    expect(result.failed).toEqual(['螺蛳粉'])
  })

  test('"炒西兰花100g" has explicit weight + cooking oil', () => {
    // 有明确重量（100g）+ 烹饪方法（炒）→ 两者都应用
    const result = parseFoodInput('炒西兰花100g', foods)
    expect(result.items).toHaveLength(1)
    // 通过规则引擎匹配（有明确重量），但仍加烹饪油
    expect(result.items[0].cookingMethod).toBe('炒')
    expect(result.items[0].oilCalories).toBe(90)
    // 西兰花 35kcal + 油 90kcal = 125kcal
    expect(result.items[0].calories).toBe(125)
    expect(result.items[0].fat).toBe(10)
  })
})

// ══════════════════════════════════════════════
//  Mutex principle: one segment, one path
// ══════════════════════════════════════════════

describe('three-layer mutex', () => {
  test('"炒西兰花" matches via substring in rule engine (3-char limit met)', () => {
    // "炒西兰花" contains "西兰花" (3 chars) → substring match in rule engine
    // no longer deferred to cooking layer since full text matches a known food
    const ruleResult = tryRuleEngine('炒西兰花', foods)
    expect(ruleResult).not.toBeNull()
    expect(ruleResult.name).toBe('西兰花')
    expect(ruleResult.calories).toBe(125) // 35 + 90 oil
    expect(ruleResult.fat).toBe(10) // 0.4 + 10 oil fat

    // Layer 2 handles it with cooking method info
    const cookingResult = tryCookingMatch('炒西兰花', foods)
    expect(cookingResult).not.toBeNull()
    expect(cookingResult.cookingMethod).toBe('炒')
    expect(cookingResult.oilCalories).toBe(90)
  })

  test('Layer 1 handles "炒西兰花300g" with cooking oil', () => {
    // "炒西兰花300g" has explicit weight → Layer 1 matches via substring
    // 同时因为检测到烹饪方法，额外加油热量和脂肪
    const result = tryRuleEngine('炒西兰花300g', foods)
    expect(result).not.toBeNull()
    expect(result.name).toBe('西兰花')
    expect(result.gramEquivalent).toBe(300)
    expect(result.cookingMethod).toBe('炒')
    expect(result.oilCalories).toBe(90)
    // 300g 西兰花 105kcal + 油 90kcal = 195kcal
    expect(result.calories).toBe(195)
    expect(result.fat).toBe(11) // 300g 西兰花 1.2g + 油 10g = 11.2 → 11
  })

  test('"红烧肉" goes to AI (substr too short after 3-char limit)', () => {
    // No weight, cooking prefix detected → tryRuleEngine defers
    expect(tryRuleEngine('红烧肉', foods)).toBeNull()
    // tryCookingMatch: extracts "肉" (1 char), too short for substring matching → null
    expect(tryCookingMatch('红烧肉', foods)).toBeNull()
    // Falls through to Layer 3 (AI)
    const result = parseFoodInput('红烧肉', foods)
    // 红烧肉 not in test foods → failed (no AI in test context)
    expect(result.failed).toContain('红烧肉')
  })
})
