const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { parseFoodInput } = require('./shared/foodParser')
const { processAISegments } = require('./shared/aiResolver')
const foods = require('./foods.json')
const compositeDishes = require('./composite_dishes.json')

const DEEPSEEK_API_KEY = 'sk-6668481e60f04261a11a0435ea54fa5a'

async function callDeepSeekDirect(dishName) {
  console.log('[parseFoodInput] AI 层开始处理:', dishName)
  try {
    const { callDeepSeek } = require('./shared/deepseekClient')
    const result = await callDeepSeek(DEEPSEEK_API_KEY, dishName)
    console.log('[parseFoodInput] AI 分解成功:', dishName)
    return result
  } catch (e) {
    console.warn('[parseFoodInput] AI 分解失败:', dishName, e.message)
    return null
  }
}

var ALL_UNITS = /(g|克|ml|毫升|个|只|根|份|碗|盘|杯|勺|片|块|条|包|盒|袋|瓶)/

function extractAmountAndUnit(rawSegment) {
  var m = (rawSegment || '').match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + ALL_UNITS.source))
  if (!m) return null
  return { amount: Number(m[1]), unit: m[2] }
}

function extractDishName(segment) {
  return segment.replace(new RegExp('\\d+(?:\\.\\d+)?\\s*' + ALL_UNITS.source, 'g'), '').trim()
}

function isWeightUnit(unit) {
  return unit === 'g' || unit === '克' || unit === 'ml' || unit === '毫升'
}

// 不在本地库的食材兜底营养 — 按关键词分档
var CATEGORY_FALLBACK = [
  { keys: ['奶', '乳'], value: { calories: 60, protein: 3, fat: 3, carb: 5 } },
  { keys: ['油', '脂'], value: { calories: 800, protein: 0, fat: 90, carb: 0 } },
  { keys: ['米', '面', '粉', '饼', '饭', '粥', '馒头', '面包', '面条'], value: { calories: 200, protein: 4, fat: 1, carb: 44 } },
  { keys: ['肉', '排', '腿', '翅', '蹄', '肘', '肝', '肚', '肠', '舌'], value: { calories: 150, protein: 15, fat: 10, carb: 0 } },
  { keys: ['酱', '料', '汤', '汁', '卤', '膏'], value: { calories: 80, protein: 2, fat: 5, carb: 7 } },
  { keys: ['菜', '蔬', '菇', '瓜', '叶', '花', '椒', '葱', '姜', '蒜'], value: { calories: 30, protein: 2, fat: 0.3, carb: 5 } },
  { keys: ['茶', '咖啡', '饮料', '酒', '啤'], value: { calories: 5, protein: 0, fat: 0, carb: 1 } }
]
var FALLBACK_DEFAULT = { calories: 100, protein: 5, fat: 4, carb: 12 }

function getFallbackPer100g(name) {
  var s = (name || '')
  for (var i = 0; i < CATEGORY_FALLBACK.length; i++) {
    for (var j = 0; j < CATEGORY_FALLBACK[i].keys.length; j++) {
      if (s.indexOf(CATEGORY_FALLBACK[i].keys[j]) !== -1) return CATEGORY_FALLBACK[i].value
    }
  }
  return FALLBACK_DEFAULT
}

async function checkDbCache(db, segment) {
  var dishName = extractDishName(segment)
  try {
    var res = await db.collection('dish_cache').doc(dishName).get()
    if (!res.data) return null
    // 过期检查
    if (res.data.expiresAt && Date.now() > res.data.expiresAt) {
      db.collection('dish_cache').doc(dishName).remove().catch(function(){})
      return null
    }
    return { cache: res.data, dishName: dishName }
  } catch (e) { return null }
}

function scaleCachedResult(cache, segment) {
  var inputInfo = extractAmountAndUnit(segment)
  var ingredients = cache.ingredients || []
  var cachedTotal = ingredients.reduce(function(s, i) { return s + (Number(i.weight) || 0) }, 0)
  var servingSize = cache.servingSize

  var scale = 1
  if (inputInfo && cachedTotal > 0) {
    if (isWeightUnit(inputInfo.unit)) {
      // 重量单位：直接按克重缩放
      if (Math.abs(inputInfo.amount - cachedTotal) > 1) scale = inputInfo.amount / cachedTotal
    } else if (servingSize && servingSize.unit === inputInfo.unit && servingSize.amount > 0) {
      // 计数单位（个/只/份…）：用缓存里的 servingSize 反推单份克重
      var perUnitGrams = servingSize.totalGrams / servingSize.amount
      var totalGrams = perUnitGrams * inputInfo.amount
      if (Math.abs(totalGrams - cachedTotal) > 1) scale = totalGrams / cachedTotal
    }
  }

  // 缩放子项
  var breakdown = ingredients.map(function(ing) {
    var g = Math.round((Number(ing.weight) || 0) * scale)
    return { name: ing.name, amount: g, unit: ing.unit || 'g', gramEquivalent: g, weight: g }
  })

  // 查找本地库计算营养
  var totalCal = 0, totalPro = 0, totalFat = 0, totalCarb = 0
  breakdown.forEach(function(b) {
    var food = null
    for (var i = 0; i < foods.length; i++) {
      if (foods[i].name === b.name || (foods[i].alias && foods[i].alias.indexOf(b.name) !== -1)) {
        food = foods[i]; break
      }
    }
    if (food) {
      var ratio = b.gramEquivalent / 100
      b.calories = Math.round(food.caloriesPer100g * ratio)
      b.protein = Math.round(food.proteinPer100g * ratio)
      b.fat = Math.round(food.fatPer100g * ratio)
      b.carb = Math.round(food.carbPer100g * ratio)
      b.estimated = false
    } else {
      var fb = getFallbackPer100g(b.name)
      var ratio = b.gramEquivalent / 100
      b.calories = Math.round(fb.calories * ratio)
      b.protein = Math.round(fb.protein * ratio)
      b.fat = Math.round(fb.fat * ratio)
      b.carb = Math.round(fb.carb * ratio)
      b.estimated = true
    }
    totalCal += b.calories; totalPro += b.protein; totalFat += b.fat; totalCarb += b.carb
  })

  return {
    name: cache.dishName || extractDishName(segment),
    rawSegment: segment,
    amount: inputInfo ? inputInfo.amount : 1,
    unit: inputInfo ? inputInfo.unit : '份',
    gramEquivalent: breakdown.reduce(function(s, b) { return s + b.gramEquivalent }, 0),
    isDefaultAmount: false,
    fromAI: true,
    calories: Math.round((cache.totalCalories || 0) * scale),
    protein: Math.round((cache.totalProtein || 0) * scale),
    fat: Math.round((cache.totalFat || 0) * scale),
    carb: Math.round((cache.totalCarb || 0) * scale),
    aiEstimated: !!cache.servingEstimate,
    oilIncluded: !!cache.oilIncluded,
    breakdown: breakdown
  }
}

exports.main = async function(event) {
  var rawInput = event.rawInput
  if (!rawInput) throw new Error('Missing rawInput')

  console.log('[parseFoodInput] 收到输入:', rawInput)
  console.log('[parseFoodInput] 食材库:', foods.length, '条, 复合菜品库:', compositeDishes.length, '条')

  var baseResult = parseFoodInput(rawInput, foods, compositeDishes)
  if (baseResult.failed.length === 0) return baseResult

  // 对每个失败段，先查 DB 缓存
  var aiSegments = []
  var cacheMerged = []
  var cacheFailed = []
  for (var i = 0; i < baseResult.failed.length; i++) {
    var seg = baseResult.failed[i]
    var cached = await checkDbCache(db, seg)
    if (cached) {
      cacheMerged.push(scaleCachedResult(cached.cache, seg))
    } else {
      aiSegments.push(seg)
    }
  }

  // 缓存未命中的走 AI
  var aiMerged = []
  var aiFailed = []
  if (aiSegments.length > 0) {
    console.log('[parseFoodInput] AI 层启动:', aiSegments)
    var aiResult = await processAISegments(aiSegments, foods, callDeepSeekDirect, db)
    aiMerged = aiResult.segmentResults.map(function(sr) { return sr.mergedItem }).filter(Boolean)
    aiFailed = aiResult.failed.filter(function(f) { return f.ingredient === null }).map(function(f) { return f.segment })

    // 缓存 AI 分解结果到 dish_cache
    for (var k = 0; k < aiResult.segmentResults.length; k++) {
      var sr = aiResult.segmentResults[k]
      if (!sr.mergedItem) continue
      var seg2 = aiSegments[k] || ''
      var dishName2 = extractDishName(seg2)
      var now = Date.now()
	      var m = sr.mergedItem
	      var inputInfo2 = extractAmountAndUnit(seg2)
	      var svSize = undefined
	      if (inputInfo2 && !isWeightUnit(inputInfo2.unit)) {
	        svSize = { amount: inputInfo2.amount, unit: inputInfo2.unit, totalGrams: m.gramEquivalent }
	      }
	      var cacheData = {
	        _id: dishName2, dishName: dishName2, confidence: 'medium',
	        oilIncluded: !!m.oilIncluded, servingEstimate: !!m.aiEstimated,
	        totalCalories: m.calories || 0, totalProtein: m.protein || 0,
	        totalFat: m.fat || 0, totalCarb: m.carb || 0,
	        ingredients: (m.breakdown || []).map(function(b) { return { name: b.name, weight: b.gramEquivalent, unit: 'g' } }),
	        servingSize: svSize,
	        createdAt: now, updatedAt: now, expiresAt: now + 30 * 24 * 60 * 60 * 1000
	      }
	      try { await db.collection('dish_cache').doc(dishName2).update({ data: cacheData }) }
	      catch (_) { try { await db.collection('dish_cache').add({ data: cacheData }) } catch (__) {} }
	    }
	  }

	  var allMerged = cacheMerged.concat(aiMerged)
	  var allFailed = cacheFailed.concat(aiFailed)

	  console.log('[parseFoodInput] 返回, 总项:', baseResult.items.length + allMerged.length, '(缓存:', cacheMerged.length, ', AI:', aiMerged.length, ')')
	  return { items: baseResult.items.concat(allMerged), failed: allFailed, _v: '20260512-inline' }
}
