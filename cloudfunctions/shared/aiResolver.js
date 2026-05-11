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
    .replace(/\d+(?:\.\d+)?\s*(g|克|个|碗|盘|杯|盒|袋|瓶|根|只|份|片|块|条|包|勺|粒)/g, '')
    .replace(/[一二两三四五六七八九半]\s*(碗|盘|杯|个|根|份)/g, '')
    .trim()
}

// 不在本地库的食材兜底营养（仅AI未提供时使用）
var FALLBACK_PER_100G = { calories: 100, protein: 5, fat: 4, carb: 12 }

// ============================================================
//  AI 结果 → items（本地库计算每种食材营养）
// ============================================================

function aiResultToItems(aiResult, rawSegment, foods) {
  const { dishName, confidence, oilIncluded, ingredients, servingEstimate,
          totalCalories, totalProtein, totalFat, totalCarb } = aiResult
  const items = []
  const failed = []

  for (const ing of ingredients) {
    const food = findFood(foods, ing.name)
    const grams = ing.weight || extractSegmentWeight(rawSegment) || 100
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
      var aiCal = ing.calories != null ? ing.calories : Math.round(FALLBACK_PER_100G.calories * ratio)
      var aiPro = ing.protein != null ? ing.protein : Math.round(FALLBACK_PER_100G.protein * ratio)
      var aiFat = ing.fat != null ? ing.fat : Math.round(FALLBACK_PER_100G.fat * ratio)
      var aiCarb = ing.carb != null ? ing.carb : Math.round(FALLBACK_PER_100G.carb * ratio)
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
    totalCalories: totalCalories || 0,
    totalProtein: totalProtein || 0,
    totalFat: totalFat || 0,
    totalCarb: totalCarb || 0,
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

async function tryAIDecompose(segment, foods, callDecomposeDish, cache) {
  const dishNameText = extractDishName(segment)
  const memCache = cache || dishCache

  const cached = memCache.getMemoryCache(dishNameText)
  if (cached) {
    return aiResultToItems(cached, segment, foods)
  }

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

  memCache.setMemoryCache(dishNameText, aiResult)
  return aiResultToItems(aiResult, segment, foods)
}

// ============================================================
//  并发处理
// ============================================================

async function processAISegments(segments, foods, callDecomposeDish, db) {
  if (!segments || segments.length === 0) {
    return { items: [], segmentResults: [], failed: [] }
  }

  const results = await Promise.allSettled(
    segments.map(seg => tryAIDecompose(seg, foods, callDecomposeDish))
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

      if (db) writeDbCache(db, extractDishName(segments[i]), r.value).catch(() => {})
    } else {
      remainingFailed.push({ segment: segments[i], ingredient: null })
    }
  }

  return { items: allItems, segmentResults, failed: remainingFailed }
}

async function writeDbCache(db, dishName, resolved) {
  try {
    const ingredients = resolved.items.map(item => ({
      name: item.name,
      weight: item.gramEquivalent,
      unit: 'g'
    }))
    await dishCache.setDishCache(db, dishName, {
      dishName: resolved.dishName || dishName,
      confidence: 'medium',
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
