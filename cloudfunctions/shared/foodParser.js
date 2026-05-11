/**
 * 三层递进食物解析器
 *
 * 架构：规则引擎 → 烹饪方法剥离 → 兜底
 *
 * 规则引擎（零 AI 成本，ms 级）：
 *   - 中文量词提取："一碗米饭" → 碗 × 150g
 *   - 后缀格式："鸡胸肉200g" → 200g
 *   - 前缀格式："200g鸡胸肉" → 200g
 *   - 默认份量："鸡胸" → defaultWeight(200g)
 *
 * 烹饪方法剥离（零 AI 成本，ms 级）：
 *   - "炒西兰花" → 剥离"炒" → "西兰花" + 油系数
 *
 * 兜底：标记为未识别
 *
 * 核心原则：三段互斥，一个段落只走一条路径。
 */

const { detectCookingMethod, extractBaseFoodName, calculateOilCalories } = require('./cookingMethods')

/**
 * 给结果项添加烹饪方法信息和用油的热量+脂肪
 * 食用油 100g 含 100g 脂肪，oilEstimate 克油 = oilEstimate 克脂肪
 */
function addOilToItem(item, cookingMethod) {
  if (!cookingMethod || !cookingMethod.config) return item
  item.cookingMethod = cookingMethod.method
  const oilGrams = cookingMethod.config.oilEstimate || 0
  if (oilGrams > 0) {
    item.oilCalories = calculateOilCalories(cookingMethod.config)
    item.calories += item.oilCalories
    item.fat += oilGrams  // 油 = 100% 脂肪
  }
  return item
}

const MEAL_WORDS = ['早餐', '午餐', '晚餐', '加餐']
const UNIT_PATTERN = '(kg|千克|g|克|ml|个|根|份|碗|杯|盘|盒|袋|瓶|罐|片|只|粒|颗|勺|串|瓣|段|块|条|包)'

// ─── 中文数词映射 ───
const CN_NUMERALS = {
  '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  '半': 0.5
}

// 常见中文容器/单位量词
const CN_CONTAINERS = ['碗', '盘', '杯', '碟', '盆', '锅', '盒', '袋', '瓶', '罐', '桶']
const CN_UNITS = ['个', '根', '块', '片', '条', '只', '份', '包', '粒', '颗', '勺', '串', '瓣', '段']

// ============================================================
//  输入预处理
// ============================================================

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

// ============================================================
//  中文量词提取器
// ============================================================

/**
 * 从输入开头提取中文量词
 *
 * 输入: "一碗螺蛳粉"     → { matched: true, amount: 1,    unit: "碗",  foodName: "螺蛳粉", rawQuantifier: "一碗" }
 * 输入: "两个鸡蛋"       → { matched: true, amount: 2,    unit: "个",  foodName: "鸡蛋",   rawQuantifier: "两个" }
 * 输入: "半碗米饭"       → { matched: true, amount: 0.5,  unit: "碗",  foodName: "米饭",   rawQuantifier: "半碗" }
 * 输入: "鸡胸肉200g"    → { matched: false }
 * 输入: "炒西兰花"       → { matched: false }
 */
function extractChineseQuantifier(text) {
  const allUnits = [...CN_CONTAINERS, ...CN_UNITS]
  // 匹配: 半碗饭, 一碗面, 两个蛋, 三份菜, 2碗饭...
  const pattern = new RegExp(
    '^([一二两三四五六七八九半]|(\\d+(?:\\.\\d+)?))' +  // 数词
    '(' + allUnits.join('|') + ')' +                      // 量词
    '(.+)$'                                               // 食物名
  )

  const match = text.match(pattern)
  if (!match) return { matched: false }

  const numeralStr = match[1]
  const unit = match[3]
  const foodName = match[4].trim()
  const amount = CN_NUMERALS[numeralStr] !== undefined
    ? CN_NUMERALS[numeralStr]
    : Number(numeralStr)

  if (!amount || amount <= 0) return { matched: false }

  return {
    matched: true,
    amount,
    unit,
    foodName,
    rawQuantifier: match[1] + match[3]
  }
}

// ============================================================
//  段落解析（增强版，保持向后兼容）
// ============================================================

/**
 * 解析单个段落文本，提取结构信息
 *
 * 支持的格式（按优先级）：
 * 1. 中文量词前缀: "一碗米饭" → { nameText: "米饭", amount: 1, unit: "碗" }
 * 2. 数字+单位+名称: "200g鸡胸肉" → { nameText: "鸡胸肉", amount: 200, unit: "g" }
 * 3. 名称+数字+单位: "鸡胸肉200g" → { nameText: "鸡胸肉", amount: 200, unit: "g" }
 * 4. 纯名称: "鸡胸" → { nameText: "鸡胸", amount: 100, unit: "g", isDefaultAmount: true }
 */
function parseSegment(segment) {
  // Step 1: 中文量词前缀 "一碗米饭"
  const quantResult = extractChineseQuantifier(segment)
  if (quantResult.matched) {
    return {
      nameText: quantResult.foodName,
      amount: quantResult.amount,
      unit: quantResult.unit,
      isDefaultAmount: false,
      fromQuantifier: true,
      rawQuantifier: quantResult.rawQuantifier
    }
  }

  // Step 2: 前缀格式 "200g鸡胸肉"
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

  // Step 3: 后缀格式 "鸡胸肉200g"（必须有数字才触发单位提取）
  // 防止 "包" 被从 "菠萝包" 中当单位拆走
  const suffixRegex = new RegExp(`^(.+?)(\\d+(?:\\.\\d+)?)\\s*${UNIT_PATTERN}?$`)
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

// ============================================================
//  食材匹配
// ============================================================

function scoreFood(food, nameText) {
  if (!food.enabled) return 0
  if (food.name === nameText) return 100 + Number(food.priority || 0)
  if ((food.alias || []).includes(nameText)) return 90 + Number(food.priority || 0)
  // 子串匹配限制：双方至少 3 个字符，防止 "虾" 误匹配 "鲜虾蟹籽云吞"
  var minLen = Math.min(food.name.length, nameText.length)
  if (minLen >= 3 && (food.name.includes(nameText) || nameText.includes(food.name))) {
    return 70 + Number(food.priority || 0)
  }
  if ((food.alias || []).some(function(alias) {
    var aLen = Math.min(alias.length, nameText.length)
    return aLen >= 3 && (alias.includes(nameText) || nameText.includes(alias))
  })) {
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

// ============================================================
//  重量转换
// ============================================================

/**
 * 将解析结果转换为克重
 *
 * 优先级：
 * 1. 用户指定的单位在 unitConversions 中 → 直接转换
 * 2. 中文量词 → unitConversions[量词] 或 defaultWeight × amount
 * 3. 用户未指定重量 → defaultWeight 或 100g
 */
function gramEquivalentFor(parsed, food) {
  if (parsed.unit === 'kg' || parsed.unit === '千克') return parsed.amount * 1000
  if (parsed.unit === 'g' || parsed.unit === '克') return parsed.amount

  const conversions = food.unitConversions || {}
  const factor = conversions[parsed.unit]

  if (factor) {
    return parsed.amount * factor
  }

  // 单位不在 conversion 中，用 defaultWeight
  const defaultWeight = food.defaultWeight || 100
  return parsed.amount * defaultWeight
}

// ============================================================
//  营养计算
// ============================================================

function calculateNutrition(food, grams) {
  const ratio = grams / 100
  return {
    calories: Math.round(Number(food.caloriesPer100g) * ratio),
    protein: Math.round(Number(food.proteinPer100g) * ratio),
    fat: Math.round(Number(food.fatPer100g) * ratio),
    carb: Math.round(Number(food.carbPer100g) * ratio)
  }
}

// ============================================================
//  三层递进解析
// ============================================================

/**
 * 构建标准结果项
 */
function buildItem(food, segment, parsed, extra = {}) {
  let grams
  if (parsed.fromQuantifier && !(food.unitConversions || {})[parsed.unit]) {
    // 中文量词但 unitConversions 中没有该单位 → 用 defaultWeight × 数量
    const defaultWeight = food.defaultWeight || 100
    grams = parsed.amount * defaultWeight
  } else {
    grams = gramEquivalentFor(parsed, food)
  }

  if (grams === null || grams === undefined) return null

  return {
    foodId: food._id,
    name: food.name,
    rawSegment: segment,
    amount: parsed.amount,
    unit: parsed.unit,
    gramEquivalent: Math.round(grams),
    isDefaultAmount: parsed.isDefaultAmount || extra.isDefaultAmount || false,
    ...calculateNutrition(food, grams),
    ...extra.meta
  }
}

/**
 * 第一层：规则引擎
 *
 * 按优先级尝试：
 * 1. 中文量词 + 食材名精确匹配
 * 2. 标准后缀/前缀格式匹配
 * 3. 纯名称精确匹配（使用 defaultWeight）
 */
function tryRuleEngine(segment, foods) {
  // 检测段落是否含烹饪方法（后续用于添加油热量）
  const cookingMethod = detectCookingMethod(segment)
  const hasExplicitWeight = /(\d+(?:\.\d+)?)\s*(kg|千克|g|克|ml)/.test(segment)

  // 含烹饪前缀但无明确重量 → 检查完整段落是否已匹配食材
  // "炒饭"、"煎蛋" 这类菜名本身就存在的，不走烹饪剥离
  if (!hasExplicitWeight && cookingMethod) {
    if (!findFood(foods, segment)) {
      return null  // 不认识 → 推迟给 Layer 2 烹饪剥离
    }
  }

  // 1a. 中文量词 + 食材名匹配
  const quantResult = extractChineseQuantifier(segment)
  if (quantResult.matched) {
    const food = findFood(foods, quantResult.foodName)
    if (food) {
      const parsed = {
        nameText: quantResult.foodName,
        amount: quantResult.amount,
        unit: quantResult.unit,
        isDefaultAmount: false,
        fromQuantifier: true
      }
      const item = buildItem(food, segment, parsed)
      // 如果有烹饪方法（如 "炒一碗米饭"），加烹饪油
      if (item && cookingMethod) addOilToItem(item, cookingMethod)
      return item
    }
  }

  // 1b. 标准后缀/前缀格式匹配
  const parsed = parseSegment(segment)
  const food = findFood(foods, parsed.nameText)
  if (food) {
    if (parsed.isDefaultAmount && food.defaultWeight) {
      parsed.amount = food.defaultWeight
    }
    const item = buildItem(food, segment, parsed)
    // 有明确重量 + 烹饪方法 → 油热量照加
    // 如 "炒西兰花100克" → 100g 西兰花 + 10g 炒油
    if (item && cookingMethod) addOilToItem(item, cookingMethod)
    return item
  }

  // 1c. 无重量纯名称匹配 → 使用 defaultWeight
  if (parsed.isDefaultAmount) {
    const foodByName = findFood(foods, segment)
    if (foodByName) {
      const defaultWeight = foodByName.defaultWeight || 100
      const item = buildItem(foodByName, segment, {
        nameText: segment,
        amount: defaultWeight,
        unit: 'g',
        isDefaultAmount: true
      }, { isDefaultAmount: true })
      if (item && cookingMethod) addOilToItem(item, cookingMethod)
      return item
    }
  }

  return null
}

/**
 * 第二层：烹饪方法剥离匹配
 *
 * 1. 剥离烹饪关键词（炒、炸、蒸...）
 * 2. 用剩余食材名匹配本地库
 * 3. 匹配成功后按烹饪系数计算油热量
 */
function tryCookingMatch(segment, foods) {
  const cookingMethod = detectCookingMethod(segment)
  if (!cookingMethod) return null

  const baseName = extractBaseFoodName(segment, cookingMethod)
  if (!baseName) return null

  const food = findFood(foods, baseName)
  if (!food) return null

  // 使用 defaultWeight 作为默认份量
  const defaultWeight = food.defaultWeight || 100
  const parsed = {
    nameText: baseName,
    amount: defaultWeight,
    unit: 'g',
    isDefaultAmount: true
  }

  const item = buildItem(food, segment, parsed)
  if (!item) return null

  // 添加烹饪油热量和脂肪
  addOilToItem(item, cookingMethod)

  return item
}

/**
 * 匹配复合菜品库
 *
 * 复合菜品有预制营养数据（servings），匹配成功直接拿值。
 * 用户指定克重时按比例缩放。
 */
function matchCompositeDish(segment, compositeDishes) {
  if (!compositeDishes || compositeDishes.length === 0) return null
  var parsed = parseSegment(segment)
  var nameText = parsed.nameText

  // 复合库只走精确/别名匹配，不走子串模糊
  // 避免 "鸡胸肉" 被 "煎鸡胸肉" 截胡
  var best = null
  for (var i = 0; i < compositeDishes.length; i++) {
    var dish = compositeDishes[i]
    if (dish.name === nameText) { best = dish; break }
    if ((dish.alias || []).indexOf(nameText) >= 0) { best = dish; break }
  }
  if (!best) return null

  // 取默认规格的营养数据
  const serving = (best.servings || []).find(s => s.isDefault) || (best.servings || [])[0]
  if (!serving) return null

  // 用户指定了数量 → 按比例缩放（非克单位通过unitConversions转换）
  var userWeight = parsed.isDefaultAmount ? null : parsed.amount
  var scale = 1
  if (userWeight && serving.weight && serving.weight > 0) {
    var convGrams = 1
    if (parsed.unit && parsed.unit !== 'g' && parsed.unit !== '克') {
      var cg = (best.unitConversions || {})[parsed.unit]
      if (cg) convGrams = cg
    }
    scale = (userWeight * convGrams) / serving.weight
  }

  return {
    foodId: best._id,
    name: best.name,
    rawSegment: segment,
    amount: userWeight || serving.weight,
    unit: 'g',
    gramEquivalent: Math.round((userWeight || serving.weight) * scale),
    isDefaultAmount: !userWeight,
    calories: Math.round((serving.calories || 0) * scale),
    protein: Math.round((serving.protein || 0) * scale),
    fat: Math.round((serving.fat || 0) * scale),
    carb: Math.round((serving.carb || 0) * scale),
    fromComposite: true,
    brand: best.brand || null,
    confidence: best.confidence || 'medium',
    nutritionSource: best.nutritionSource || 'ingredient_calculated'
  }
}

/**
 * 多库路由解析入口
 *
 * 查库顺序：复合菜品库 → 基础食材库 → 烹饪剥离 → 未识别（→AI层）
 */
function resolveSegment(segment, foods, compositeDishes) {
  // Layer 0: 复合菜品库精确匹配
  if (compositeDishes && compositeDishes.length > 0) {
    const dishResult = matchCompositeDish(segment, compositeDishes)
    if (dishResult) return dishResult
  }

  // Layer 1: 规则引擎（基础食材库）
  const ruleResult = tryRuleEngine(segment, foods)
  if (ruleResult) return ruleResult

  // Layer 2: 烹饪方法剥离
  const cookingResult = tryCookingMatch(segment, foods)
  if (cookingResult) return cookingResult

  // Layer 3: 未识别
  return null
}

// ============================================================
//  主入口
// ============================================================

/**
 * 解析用户输入的食物文本
 *
 * @param {string} rawInput - 用户原始输入，如 "红烧肉200g，米饭一碗，炒西兰花"
 * @param {Array} foods - 基础食材列表
 * @param {Array} [compositeDishes] - 可选，复合菜品列表
 * @returns {{ items: Array, failed: Array }}
 */
function parseFoodInput(rawInput, foods, compositeDishes) {
  const segments = splitSegments(rawInput)
  const items = []
  const failed = []

  segments.forEach(segment => {
    const result = resolveSegment(segment, foods, compositeDishes)
    if (result) {
      items.push(result)
    } else {
      failed.push(segment)
    }
  })

  return { items, failed }
}

module.exports = {
  parseFoodInput,
  parseSegment,
  findFood,
  gramEquivalentFor,
  calculateNutrition,
  extractChineseQuantifier,
  tryRuleEngine,
  tryCookingMatch,
  resolveSegment,
  matchCompositeDish
}
