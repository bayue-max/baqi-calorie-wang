const { extractDishName, aiResultToItems, tryAIDecompose, processAISegments, mergeAISegmentToItem } = require('../cloudfunctions/shared/aiResolver')
const { clearMemoryCache } = require('../cloudfunctions/shared/dishCache')

const foods = [
  { _id: 'chicken', name: '鸡胸肉', alias: ['鸡胸', '鸡肉'], state: 'raw', defaultWeight: 200, caloriesPer100g: 120, proteinPer100g: 23, fatPer100g: 2.5, carbPer100g: 0, unitConversions: { g: 1, 克: 1 }, priority: 10, enabled: true },
  { _id: 'rice', name: '米饭', alias: ['白米饭', '饭'], state: 'cooked', defaultWeight: 150, caloriesPer100g: 116, proteinPer100g: 2.6, fatPer100g: 0.3, carbPer100g: 25.9, unitConversions: { g: 1, 克: 1 }, priority: 10, enabled: true },
  { _id: 'pork_belly', name: '五花肉', alias: ['五花肉'], state: 'raw', defaultWeight: 200, caloriesPer100g: 395, proteinPer100g: 13, fatPer100g: 37, carbPer100g: 0, unitConversions: { g: 1, 克: 1 }, priority: 6, enabled: true },
  { _id: 'oil', name: '食用油', alias: ['炒菜油'], state: 'standard', defaultWeight: 10, caloriesPer100g: 884, proteinPer100g: 0, fatPer100g: 100, carbPer100g: 0, unitConversions: { g: 1, 克: 1 }, priority: 1, enabled: true },
  { _id: 'tofu', name: '豆腐', alias: ['豆腐', '北豆腐'], state: 'standard', defaultWeight: 150, caloriesPer100g: 84, proteinPer100g: 8, fatPer100g: 4.8, carbPer100g: 3.4, unitConversions: { g: 1, 克: 1 }, priority: 8, enabled: true }
]

function freshCache() {
  const map = new Map()
  return { getMemoryCache: (key) => map.get(key) || null, setMemoryCache: (key, data) => map.set(key, data) }
}

beforeEach(() => { clearMemoryCache() })

// ============================================================
//  aiResultToItems — 本地库计算每食材营养
// ============================================================

describe('aiResultToItems', () => {
  test('AI 给总营养 + 食材名+克重 → 本地库算每日食材营养', () => {
    const aiResult = {
      dishName: '红烧肉',
      totalCalories: 880, totalProtein: 26, totalFat: 84, totalCarb: 0,
      confidence: 'high', oilIncluded: true, servingEstimate: false,
      ingredients: [
        { name: '五花肉', weight: 200, unit: 'g' },
        { name: '食用油', weight: 10, unit: 'g' }
      ]
    }

    const result = aiResultToItems(aiResult, '红烧肉200g', foods)
    expect(result.items).toHaveLength(2)
    // 五花肉 200g: 395×2 = 790kcal
    expect(result.items[0].name).toBe('五花肉')
    expect(result.items[0].calories).toBe(790)
    // 食用油 10g: 884×0.1 = 88kcal
    expect(result.items[1].name).toBe('食用油')
    expect(result.items[1].calories).toBe(88)
    // AI 总量保留
    expect(result.totalCalories).toBe(880)
  })

  test('不在库的食材兜底估算', () => {
    const aiResult = {
      dishName: '螺蛳粉',
      totalCalories: 600, totalProtein: 18, totalFat: 22, totalCarb: 80,
      ingredients: [
        { name: '米饭', weight: 200, unit: 'g' },
        { name: '酸笋', weight: 30, unit: 'g' }
      ],
      servingEstimate: true
    }

    const result = aiResultToItems(aiResult, '螺蛳粉', foods)
    expect(result.items).toHaveLength(2)
    // 米饭在库
    expect(result.items[0].estimated).toBe(false)
    expect(result.items[0].calories).toBe(232) // 116×2
    // 酸笋不在库 → 兜底 100kcal/100g × 0.3 = 30
    expect(result.items[1].estimated).toBe(true)
    expect(result.items[1].calories).toBe(30)
  })
})

// ============================================================
//  mergeAISegmentToItem
// ============================================================

describe('mergeAISegmentToItem', () => {
  test('用 AI 总量作为汇总数据', () => {
    const result = {
      items: [
        { name: '五花肉', amount: 200, unit: 'g', gramEquivalent: 200, calories: 790, protein: 26, fat: 74, carb: 0, estimated: false },
        { name: '食用油', amount: 10, unit: 'g', gramEquivalent: 10, calories: 88, protein: 0, fat: 10, carb: 0, estimated: false }
      ],
      dishName: '红烧肉', servingEstimate: false, oilIncluded: true,
      totalCalories: 880, totalProtein: 26, totalFat: 84, totalCarb: 0
    }

    const merged = mergeAISegmentToItem(result, '红烧肉200g')
    expect(merged.name).toBe('红烧肉')
    expect(merged.calories).toBe(880) // AI 总量
    expect(merged.breakdown).toHaveLength(2)
  })
})

// ============================================================
//  tryAIDecompose & processAISegments
// ============================================================

describe('tryAIDecompose', () => {
  test('AI 调用 + 缓存', async () => {
    let callCount = 0
    const mockAI = async (segment) => {
      callCount++
      return {
        dishName: '红烧肉', totalCalories: 880, totalProtein: 26, totalFat: 84, totalCarb: 0,
        ingredients: [
          { name: '五花肉', weight: 200, unit: 'g' },
          { name: '食用油', weight: 10, unit: 'g' }
        ],
        servingEstimate: false
      }
    }

    const cache = freshCache()
    const r1 = await tryAIDecompose('红烧肉200g', foods, mockAI, cache)
    expect(r1).not.toBeNull()
    expect(r1.items).toHaveLength(2)
    expect(callCount).toBe(1)

    const r2 = await tryAIDecompose('红烧肉200g', foods, mockAI, cache)
    expect(r2).not.toBeNull()
    expect(callCount).toBe(1) // cache hit
  })

  test('AI 失败返回 null', async () => {
    const mockAI = async () => { throw new Error('fail') }
    const r = await tryAIDecompose('fail', foods, mockAI, freshCache())
    expect(r).toBeNull()
  })
})

describe('processAISegments', () => {
  test('并发处理多个段落', async () => {
    let callCount = 0
    const mockAI = async (segment) => {
      callCount++
      return {
        dishName: segment, totalCalories: 500, totalProtein: 20, totalFat: 20, totalCarb: 50,
        ingredients: [{ name: '米饭', weight: 200, unit: 'g' }],
        servingEstimate: true
      }
    }

    const result = await processAISegments(['红烧肉', '红烧排骨'], foods, mockAI)
    expect(result.items).toHaveLength(2)
    expect(callCount).toBe(2)
  })

  test('混合成功失败', async () => {
    const mockAI = async (name) => {
      if (name === 'fail') throw new Error('fail')
      return {
        dishName: name, totalCalories: 500, totalProtein: 20, totalFat: 20, totalCarb: 50,
        ingredients: [{ name: '米饭', weight: 200, unit: 'g' }],
        servingEstimate: true
      }
    }

    const result = await processAISegments(['红烧肉', 'fail', '红烧排骨'], foods, mockAI)
    expect(result.items).toHaveLength(2)
    expect(result.failed).toHaveLength(1)
  })
})
