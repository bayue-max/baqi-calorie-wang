/**
 * AI 菜品分解服务（Layer 3）— 精简版
 *
 * AI 负责：拆解食材名+克重 + 整菜总营养素（含隐性调料）
 * 后端负责：本库食材查 local nutrition，不在库的兜底
 *
 * 流：缓存在内存 | 调 DeepSeek → 匹配本地库 → 合并展示
 * 旧校准版备在 backup/calibration-v1/
 */

const { findFood, calculateNutrition } = require('./foodParser')
const dishCache = require('./dishCache')

// ============================================================
//  辅助函数
// ============================================================

function extractDishName(segment) {
  return segment
    .replace(/\d+(?:\.\d+)?\s*(g|克|ml|毫升|个|只|根|份|碗|盘|杯|勺|片|块|条|包|盒|袋|瓶)/g, '')
    .trim()
}

// 不在本地库的食材兜底营养 — 按食材名关键词分档，比一刀切 100 更准
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
  var s = (name || '').toLowerCase()
  for (var i = 0; i < CATEGORY_FALLBACK.length; i++) {
    for (var j = 0; j < CATEGORY_FALLBACK[i].keys.length; j++) {
      if (s.indexOf(CATEGORY_FALLBACK[i].keys[j]) !== -1) return CATEGORY_FALLBACK[i].value
    }
  }
  return FALLBACK_DEFAULT
}

// ============================================================
//  AI 结果 → items（本地库计算每种食材营养）
// ============================================================

function extractWeight(rawSegment) {
  const m = (rawSegment || '').match(/(\d+(?:\.\d+)?)\s*(g|克|ml|毫升)/)
  return m ? Number(m[1]) : 0
}

function aiResultToItems(aiResult, rawSegment, foods) {
  const { dishName, confidence, oilIncluded, ingredients, servingEstimate,
          totalCalories, totalProtein, totalFat, totalCarb } = aiResult
  const items = []
  const failed = []

  // 缓存中食材总克重 vs 用户当前输入克重 → 不等则等比缩放
  const inputWeight = extractWeight(rawSegment)
  const cachedTotal = ingredients.reduce((sum, ing) => sum + (Number(ing.weight) || 0), 0)
  const scale = (inputWeight > 0 && cachedTotal > 0 && Math.abs(inputWeight - cachedTotal) > 1)
    ? inputWeight / cachedTotal
    : 1

  for (const ing of ingredients) {
    const food = findFood(foods, ing.name)
    const grams = Math.round((Number(ing.weight) || inputWeight || 100) * scale)
    const unit = ing.unit || 'g'

    if (food) {
      const finalGrams = unit === 'g' ? grams : (grams * (food.unitConversions?.[unit] || 1))
      items.push({
        foodId: food._id,
        name: food.name,
        rawSegment,
        amount: grams,
        unit,
        gramEquivalent: Math.round(finalGrams),
        isDefaultAmount: false,
        ...calculateNutrition(food, finalGrams),
        fromAI: true,
        confidence: confidence || 'medium',
        estimated: false
      })
    } else {
      var ratio = grams / 100
      var fb = getFallbackPer100g(ing.name)
      var aiCal = ing.calories != null ? Math.round(ing.calories * scale) : Math.round(fb.calories * ratio)
      var aiPro = ing.protein != null ? Math.round(ing.protein * scale) : Math.round(fb.protein * ratio)
      var aiFat = ing.fat != null ? Math.round(ing.fat * scale) : Math.round(fb.fat * ratio)
      var aiCarb = ing.carb != null ? Math.round(ing.carb * scale) : Math.round(fb.carb * ratio)
      items.push({
        foodId: null,
        name: ing.name,
        rawSegment,
        amount: grams,
        unit,
        gramEquivalent: Math.round(grams),
        isDefaultAmount: false,
        calories: aiCal,
        protein: aiPro,
        fat: aiFat,
        carb: aiCarb,
        fromAI: true,
        confidence: 'low',
        estimated: true
      })
      failed.push(ing.name)
    }
  }

  return {
    items, failed, dishName,
    totalCalories: totalCalories ? Math.round(totalCalories * scale) : 0,
    totalProtein: totalProtein ? Math.round(totalProtein * scale) : 0,
    totalFat: totalFat ? Math.round(totalFat * scale) : 0,
    totalCarb: totalCarb ? Math.round(totalCarb * scale) : 0,
    oilIncluded: !!oilIncluded,
    servingEstimate: !!servingEstimate,
    decomposedBy: 'ai'
  }
}

// ============================================================
//  合并为一条复合记录
// ============================================================

function mergeAISegmentToItem(result, rawSegment) {
  const { items, dishName, servingEstimate, oilIncluded,
          totalCalories, totalProtein, totalFat, totalCarb } = result
  if (!items || items.length === 0) return null

  return {
    name: dishName || rawSegment,
    rawSegment,
    amount: 1,
    unit: '份',
    gramEquivalent: items.reduce((s, i) => s + (i.gramEquivalent || 0), 0),
    isDefaultAmount: false,
    fromAI: true,
    calories: totalCalories || 0,
    protein: totalProtein || 0,
    fat: totalFat || 0,
    carb: totalCarb || 0,
    aiEstimated: !!servingEstimate,
    oilIncluded: !!oilIncluded,
    breakdown: items.map(item => ({
      name: item.name,
      amount: item.amount,
      unit: item.unit,
      gramEquivalent: item.gramEquivalent,
      calories: item.calories,
      protein: item.protein || 0,
      fat: item.fat || 0,
      carb: item.carb || 0,
      estimated: item.estimated || false
    }))
  }
}

// ============================================================
//  AI 调用 & 缓存
// ============================================================

async function tryAIDecompose(segment, foods, callDecomposeDish, db) {
  const dishNameText = extractDishName(segment)

  // 1. 内存缓存（同一次云函数调用内共享）
  const memCached = dishCache.getMemoryCache(dishNameText)
  if (memCached) {
    return aiResultToItems(memCached, segment, foods)
  }

  // 2. 数据库缓存（跨用户、跨调用复用）
  if (db) {
    try {
      const dbCached = await dishCache.getDishCache(db, dishNameText)
      if (dbCached) {
        dishCache.setMemoryCache(dishNameText, dbCached)
        return aiResultToItems(dbCached, segment, foods)
      }
    } catch (e) { /* 忽略 DB 读取错误，继续调 AI */ }
  }

  // 3. 调 AI 分解
  let aiResult
  try {
    aiResult = await callDecomposeDish(segment)
  } catch (e) {
    console.warn('[aiResolver] AI call failed:', e.message)
    return null
  }
  if (!aiResult || !aiResult.ingredients || aiResult.ingredients.length === 0) {
    return null
  }

  // 写入缓存
  const result = aiResultToItems(aiResult, segment, foods)
  dishCache.setMemoryCache(dishNameText, aiResult)
  // 低置信度不写 DB，避免错误数据扩散
  if (db && aiResult.confidence !== 'low') {
    writeDbCache(db, dishNameText, result, aiResult.confidence).catch(() => {})
  }
  return result
}

// ============================================================
//  并发处理
// ============================================================

async function processAISegments(segments, foods, callDecomposeDish, db) {
  if (!segments || segments.length === 0) {
    return { items: [], segmentResults: [], failed: [] }
  }

  const results = await Promise.allSettled(
    segments.map(seg => tryAIDecompose(seg, foods, callDecomposeDish, db))
  )

  const allItems = []
  const segmentResults = []
  const remainingFailed = []

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled' && r.value) {
      allItems.push(...r.value.items)
      segmentResults.push({
        segment: segments[i],
        mergedItem: mergeAISegmentToItem(r.value, segments[i])
      })
      remainingFailed.push(...r.value.failed.map(f => ({
        segment: segments[i],
        ingredient: f
      })))
    } else {
      remainingFailed.push({ segment: segments[i], ingredient: null })
    }
  }

  return { items: allItems, segmentResults, failed: remainingFailed }
}

async function writeDbCache(db, dishName, resolved, aiConfidence) {
  try {
    const ingredients = resolved.items.map(item => ({
      name: item.name,
      weight: item.gramEquivalent,
      unit: 'g'
    }))
    await dishCache.setDishCache(db, dishName, {
      dishName: resolved.dishName || dishName,
      confidence: aiConfidence || 'medium',
      oilIncluded: !!resolved.oilIncluded,
      servingEstimate: !!resolved.servingEstimate,
      totalCalories: resolved.totalCalories,
      totalProtein: resolved.totalProtein || 0,
      totalFat: resolved.totalFat || 0,
      totalCarb: resolved.totalCarb || 0,
      ingredients
    })
  } catch (e) { /* ignore */ }
}

module.exports = {
  tryAIDecompose,
  processAISegments,
  extractDishName,
  aiResultToItems,
  mergeAISegmentToItem
}
