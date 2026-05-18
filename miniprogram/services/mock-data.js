const mockUser = {
  _id: 'mock_user',
  accountType: 'mock',
  nickname: '八月',
  gender: 'male',
  age: 30,
  height: 175,
  weight: 72.5,
  goal: 'fat_loss',
  profileCompleted: true
}

let mockPlan = calculateUserPlan(mockUser)
let records = []

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

function formatDate(date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date, offset) {
  const next = new Date(date)
  next.setDate(next.getDate() + offset)
  return next
}

function today() {
  return formatDate(new Date())
}

function calculateUserPlan(profile) {
  const dailyActivityFactor = 1.2
  const adjustmentMap = { fat_loss: -350, maintain: 0, muscle_gain: 250 }
  const proteinMap = { fat_loss: 2, maintain: 1.6, muscle_gain: 1.8 }
  const bmrRaw = profile.gender === 'male'
    ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5
    : 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161
  const tdeeRaw = bmrRaw * dailyActivityFactor
  const targetRaw = tdeeRaw + adjustmentMap[profile.goal]
  const idealWeight = profile.gender === 'male' ? (profile.height - 100) * 0.9 : (profile.height - 100) * 0.85
  const adjustedWeight = idealWeight + 0.4 * Math.max(0, profile.weight - idealWeight)
  const proteinWeight = Math.max(adjustedWeight, profile.weight * 0.5)
  const proteinRaw = proteinWeight * proteinMap[profile.goal]
  const fatRaw = targetRaw * 0.25 / 9
  const carbRaw = (targetRaw - proteinRaw * 4 - fatRaw * 9) / 4
  return {
    bmr: Math.round(bmrRaw),
    activityFactor: dailyActivityFactor,
    tdee: Math.round(tdeeRaw),
    dailyActivityBurn: Math.round(tdeeRaw - bmrRaw),
    habitBurn: Math.round(tdeeRaw - bmrRaw),
    goal: profile.goal,
    calorieAdjustment: adjustmentMap[profile.goal],
    targetCalories: Math.round(targetRaw),
    proteinTarget: Math.round(proteinRaw),
    fatTarget: Math.round(fatRaw),
    carbTarget: Math.round(carbRaw)
  }
}

function calculateDailySummary(items, plan) {
  const foodRecords = items.filter(record => record.recordType === 'food')
  const exerciseRecords = items.filter(record => record.recordType === 'exercise')
  const sum = field => foodRecords.reduce((total, record) => total + Number(record[field] || 0), 0)
  const foodCalories = Math.round(sum('calories'))
  const proteinTotal = Math.round(sum('protein'))
  const fatTotal = Math.round(sum('fat'))
  const carbTotal = Math.round(sum('carb'))
  const exerciseBurn = Math.abs(Math.round(exerciseRecords.reduce((total, record) => total + Number(record.calories || 0), 0)))
  const dynamicTargetCalories = plan.targetCalories + exerciseBurn
  const dynamicProteinTarget = plan.proteinTarget
  const dynamicFatTarget = Math.round(dynamicTargetCalories * 0.25 / 9)
  const dynamicCarbTarget = Math.round((dynamicTargetCalories - dynamicProteinTarget * 4 - dynamicFatTarget * 9) / 4)
  return {
    bmr: plan.bmr,
    targetCalories: plan.targetCalories,
    exerciseBurn,
    dynamicTargetCalories,
    foodCalories,
    netCalories: foodCalories - exerciseBurn,
    proteinTotal,
    fatTotal,
    carbTotal,
    dynamicProteinTarget,
    dynamicFatTarget,
    dynamicCarbTarget,
    remainingCalories: dynamicTargetCalories - foodCalories,
    remainingProtein: dynamicProteinTarget - proteinTotal,
    remainingFat: dynamicFatTarget - fatTotal,
    remainingCarb: dynamicCarbTarget - carbTotal
  }
}

// ─── 中文量词辅助（mock 内联版） ───
const CN_NUMERALS_MOCK = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '半': 0.5 }
const CN_CONTAINERS_MOCK = ['碗', '盘', '杯', '碟', '盆', '锅', '盒', '袋', '瓶', '罐', '桶']
const CN_UNITS_MOCK = ['个', '根', '块', '片', '条', '只', '份', '包', '粒', '颗', '勺', '串', '瓣', '段']

function extractChineseQuantifierMock(text) {
  const allUnits = [...CN_CONTAINERS_MOCK, ...CN_UNITS_MOCK]
  const pattern = new RegExp('^([一二两三四五六七八九半]|(\\d+(?:\\.\\d+)?))(' + allUnits.join('|') + ')(.+)$')
  const match = text.match(pattern)
  if (!match) return { matched: false }
  const amount = CN_NUMERALS_MOCK[match[1]] !== undefined ? CN_NUMERALS_MOCK[match[1]] : Number(match[1])
  if (!amount || amount <= 0) return { matched: false }
  return { matched: true, amount, unit: match[3], foodName: match[4].trim(), rawQuantifier: match[1] + match[3] }
}

// ─── 烹饪方法辅助（mock 内联版） ───
const COOKING_METHODS_MOCK = {
  '炒': { labels: ['炒', '爆炒'], oilEstimate: 10 },
  '煎': { labels: ['煎', '干煎', '香煎'], oilEstimate: 12 },
  '炸': { labels: ['炸', '油炸', '酥炸', '干炸'], oilEstimate: 25 },
  '蒸': { labels: ['蒸', '清蒸'], oilEstimate: 0 },
  '煮': { labels: ['煮', '水煮', '白煮'], oilEstimate: 0 },
  '红烧': { labels: ['红烧', '焖烧'], oilEstimate: 12 },
  '烤': { labels: ['烤', '烘烤', '炙烤'], oilEstimate: 0 },
  '凉拌': { labels: ['凉拌', '拌'], oilEstimate: 8 },
  '白灼': { labels: ['白灼'], oilEstimate: 0 },
  '炖': { labels: ['炖', '煲', '慢炖'], oilEstimate: 0 },
  '焖': { labels: ['焖'], oilEstimate: 0 }
}

function detectCookingMethodMock(text) {
  for (const [method, config] of Object.entries(COOKING_METHODS_MOCK)) {
    for (const label of config.labels) {
      if (text.startsWith(label) || text.includes(label)) return { method, config }
    }
  }
  return null
}

function extractBaseFoodNameMock(text, cookingMethod) {
  if (!cookingMethod) return text.trim()
  for (const label of cookingMethod.config.labels) {
    if (text.startsWith(label)) return text.slice(label.length).trim()
  }
  return text.trim()
}

function findFoodMock(foodList, nameText) {
  return foodList.find(item =>
    item.name === nameText || (item.alias || []).includes(nameText) || item.name.includes(nameText)
  ) || null
}

function gramEquivalentMock(parsed, food) {
  if (parsed.unit === 'kg' || parsed.unit === '千克') return parsed.amount * 1000
  if (parsed.unit === 'g' || parsed.unit === '克') return parsed.amount
  const factor = (food.unitConversions || {})[parsed.unit]
  if (factor) return parsed.amount * factor
  return parsed.amount * (food.defaultWeight || 100)
}

function buildItemMock(food, segment, parsed, extra) {
  let grams
  if (parsed.fromQuantifier && !(food.unitConversions || {})[parsed.unit]) {
    grams = parsed.amount * (food.defaultWeight || 100)
  } else {
    grams = gramEquivalentMock(parsed, food)
  }
  if (grams == null) return null
  const ratio = grams / 100
  return {
    foodId: food._id,
    name: food.name,
    rawSegment: segment,
    amount: parsed.amount,
    unit: parsed.unit,
    gramEquivalent: Math.round(grams),
    isDefaultAmount: parsed.isDefaultAmount || (extra && extra.isDefaultAmount) || false,
    calories: Math.round(food.caloriesPer100g * ratio),
    protein: Math.round(food.proteinPer100g * ratio),
    fat: Math.round(food.fatPer100g * ratio),
    carb: Math.round(food.carbPer100g * ratio),
    ...(extra && extra.meta ? extra.meta : {})
  }
}

/**
 * 三层递进食物解析（mock 内联版，与 cloudfunctions 同步）
 *
 * Layer 1: 规则引擎（中文量词 + 数字格式 + 默认份量）
 * Layer 2: 烹饪方法剥离匹配 + 油热量
 * Layer 3: 兜底 → 标记未识别
 */
function parseFoodInputCore(rawInput, foodList) {
  const segments = rawInput
    .replace(/早餐|午餐|晚餐|加餐/g, '')
    .replace(/，|、|；|;/g, ',')
    .split(',')
    .flatMap(segment => segment.trim().includes(' ') ? segment.trim().split(/\s+/) : [segment.trim()])
    .filter(Boolean)
  const items = []
  const failed = []

  segments.forEach(segment => {
    // Layer 1: 规则引擎
    // 1a. 中文量词 "一碗米饭"
    const quantResult = extractChineseQuantifierMock(segment)
    if (quantResult.matched) {
      const food = findFoodMock(foodList, quantResult.foodName)
      if (food) {
        const parsed = { nameText: quantResult.foodName, amount: quantResult.amount, unit: quantResult.unit, isDefaultAmount: false, fromQuantifier: true }
        const item = buildItemMock(food, segment, parsed)
        if (item) { items.push(item); return }
      }
    }

    // 1b. 标准格式 "200g鸡胸肉" / "鸡胸肉200g"
    const prefixMatch = segment.match(/^(\d+(?:\.\d+)?)\s*(kg|千克|g|克|ml|个|根|份|碗|杯|盒|袋|只|片|块|条|包)\s*(.+)$/)
    const suffixMatch = prefixMatch ? null : segment.match(/^(.+?)(\d+(?:\.\d+)?)?\s*(kg|千克|g|克|ml|个|根|份|碗|杯|盒|袋|只|片|块|条|包)?$/)
    const parsed = prefixMatch
      ? { nameText: prefixMatch[3].trim(), amount: Number(prefixMatch[1]), unit: prefixMatch[2], isDefaultAmount: false }
      : {
          nameText: suffixMatch ? suffixMatch[1].trim() : segment,
          amount: suffixMatch && suffixMatch[2] ? Number(suffixMatch[2]) : 100,
          unit: suffixMatch && suffixMatch[3] ? suffixMatch[3] : 'g',
          isDefaultAmount: !(suffixMatch && suffixMatch[2])
        }

    const food = findFoodMock(foodList, parsed.nameText)
    if (food) {
      // 用户未指定重量时，使用食材的 defaultWeight（如有）
      if (parsed.isDefaultAmount && food.defaultWeight) {
        parsed.amount = food.defaultWeight
      }
      const item = buildItemMock(food, segment, parsed)
      if (item) { items.push(item); return }
    }

    // 1c. 纯名称匹配 + defaultWeight
    if (parsed.isDefaultAmount) {
      const directFood = findFoodMock(foodList, segment)
      if (directFood) {
        const dw = directFood.defaultWeight || 100
        const item = buildItemMock(directFood, segment, { nameText: segment, amount: dw, unit: 'g', isDefaultAmount: true })
        if (item) { items.push(item); return }
      }
    }

    // Layer 2: 烹饪方法剥离
    const cookingMethod = detectCookingMethodMock(segment)
    if (cookingMethod) {
      const baseName = extractBaseFoodNameMock(segment, cookingMethod)
      if (baseName) {
        const cookingFood = findFoodMock(foodList, baseName)
        if (cookingFood) {
          const dw = cookingFood.defaultWeight || 100
          const item = buildItemMock(cookingFood, segment, { nameText: baseName, amount: dw, unit: 'g', isDefaultAmount: true })
          if (item) {
            item.cookingMethod = cookingMethod.method
            const oilCal = Math.round((cookingMethod.config.oilEstimate || 0) * 9)
            if (oilCal > 0) {
              item.oilCalories = oilCal
              item.calories += oilCal
            }
            items.push(item)
            return
          }
        }
      }
    }

    // Layer 3: 未识别
    failed.push(segment)
  })

  return { items, failed }
}

function calculateExerciseBurn({ weight, intensity, duration }) {
  const map = { brisk_walk: 0.06, elliptical: 0.08, cycling: 0.11, jogging: 0.13, swimming: 0.13, treadmill_climb: 0.15, hiit: 0.16, jump_rope: 0.19, light_strength: 0.04, moderate_strength: 0.05, heavy_strength: 0.07 }
  return Math.round(map[intensity] * weight * duration)
}

function buildExerciseRecordName(intensity, duration) {
  const map = {
    brisk_walk: '快走', elliptical: '椭圆机', cycling: '骑行',
    jogging: '慢跑', swimming: '游泳', treadmill_climb: '跑步机爬坡',
    hiit: 'HIIT', jump_rope: '跳绳',
    light_strength: '轻度力量训练', moderate_strength: '中度力量训练', heavy_strength: '重度力量训练'
  }
  return `${map[intensity]} ${duration}min`
}

function summary() {
  return calculateDailySummary(records, mockPlan)
}

async function loginAsTestUser() {
  return { user: mockUser, isNew: false }
}

async function getHomeData() {
  return {
    user: mockUser,
    plan: mockPlan,
    date: today(),
    records,
    summary: summary()
  }
}

async function getProfile() {
  return { user: mockUser, plan: mockPlan }
}

async function saveProfile({ profile }) {
  Object.assign(mockUser, profile, { profileCompleted: true })
  mockPlan = calculateUserPlan(mockUser)
  return { user: mockUser, plan: mockPlan, summary: summary() }
}

async function parseFoodInput({ rawInput }) {
  return parseFoodInputCore(rawInput, foods)
}

async function addFoodRecords({ mealType, rawInput, items }) {
  const now = Date.now()
  const added = items.map((item, index) => ({
    _id: `mock_food_${now}_${index}`,
    userId: mockUser._id,
    date: today(),
    recordType: 'food',
    recordGroupId: `mock_group_${now}`,
    mealType,
    rawInput,
    ...item,
    createdAt: now,
    updatedAt: now
  }))
  records = records.concat(added)
  return { records: added, summary: summary() }
}

async function addExerciseRecord({ intensity, duration }) {
  const now = Date.now()
  const numericDuration = Number(duration)
  const burn = calculateExerciseBurn({
    weight: mockUser.weight,
    intensity,
    duration: numericDuration
  })
  const record = {
    _id: `mock_exercise_${now}`,
    userId: mockUser._id,
    date: today(),
    recordType: 'exercise',
    mealType: 'exercise',
    name: buildExerciseRecordName(intensity, numericDuration).replace(` ${numericDuration}min`, ''),
    exerciseIntensity: intensity,
    duration: numericDuration,
    calories: -burn,
    protein: 0,
    fat: 0,
    carb: 0,
    createdAt: now,
    updatedAt: now
  }
  records = records.concat(record)
  return { record, summary: summary() }
}

async function deleteRecord({ recordId }) {
  records = records.filter(record => record._id !== recordId)
  return { deletedRecordId: recordId, summary: summary() }
}

async function getStats({ mode = 'week' }) {
  const endDate = new Date()
  const startDate = addDays(endDate, mode === 'month' ? -29 : -6)
  return {
    mode,
    range: { start: formatDate(startDate), end: formatDate(endDate) },
    bmr: mockPlan.bmr,
    targetCalories: mockPlan.targetCalories,
    totalBurnCalories: mockPlan.tdee,
    points: [
      {
        date: formatDate(addDays(endDate, -2)),
        foodCalories: 1800,
        dynamicTargetCalories: mockPlan.targetCalories,
        totalBurnCalories: mockPlan.tdee
      },
      {
        date: formatDate(addDays(endDate, -1)),
        foodCalories: 2100,
        dynamicTargetCalories: mockPlan.targetCalories,
        totalBurnCalories: mockPlan.tdee
      },
      {
        date: today(),
        foodCalories: summary().foodCalories,
        dynamicTargetCalories: summary().dynamicTargetCalories,
        totalBurnCalories: mockPlan.tdee + summary().exerciseBurn
      }
    ]
  }
}

// ─── AI 菜品分解 Mock ───
const AI_DECOMPOSE_CACHE = {
  '红烧肉': {
    dishName: '红烧肉', confidence: 'high', oilIncluded: true,
    ingredients: [
      { name: '五花肉', weight: 200, unit: 'g' },
      { name: '食用油', weight: 10, unit: 'g' }
    ],
    servingEstimate: true, fromAI: true
  },
  '番茄炒蛋': {
    dishName: '番茄炒蛋', confidence: 'high', oilIncluded: true,
    ingredients: [
      { name: '番茄', weight: 150, unit: 'g' },
      { name: '鸡蛋', weight: 100, unit: 'g' },
      { name: '食用油', weight: 10, unit: 'g' }
    ],
    servingEstimate: true, fromAI: true
  },
  '宫保鸡丁': {
    dishName: '宫保鸡丁', confidence: 'high', oilIncluded: true,
    ingredients: [
      { name: '鸡胸肉', weight: 150, unit: 'g' },
      { name: '花生', weight: 30, unit: 'g' },
      { name: '葱', weight: 20, unit: 'g' },
      { name: '干辣椒', weight: 5, unit: 'g' },
      { name: '食用油', weight: 12, unit: 'g' }
    ],
    servingEstimate: true, fromAI: true
  }
}

async function decomposeDish({ dishName }) {
  // 去除重量信息，用纯菜名查缓存
  const cleanName = dishName.replace(/\d+(?:\.\d+)?\s*[g克]/, '').trim()
  const cached = AI_DECOMPOSE_CACHE[cleanName]
  if (cached) {
    return { ...cached, dishName: cleanName }
  }
  // 未命中缓存 → 模拟 AI 返回兜底
  return {
    dishName: cleanName,
    confidence: 'low',
    oilIncluded: false,
    ingredients: [{ name: cleanName, weight: 200, unit: 'g' }],
    servingEstimate: true,
    fromAI: true
  }
}

module.exports = {
  loginAsTestUser,
  getHomeData,
  getProfile,
  saveProfile,
  parseFoodInput,
  addFoodRecords,
  addExerciseRecord,
  deleteRecord,
  getStats,
  decomposeDish
}
