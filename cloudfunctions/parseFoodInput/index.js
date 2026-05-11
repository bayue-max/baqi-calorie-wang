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

exports.main = async function(event) {
  var rawInput = event.rawInput
  if (!rawInput) throw new Error('Missing rawInput')

  console.log('[parseFoodInput] 收到输入:', rawInput)
  console.log('[parseFoodInput] 食材库:', foods.length, '条, 复合菜品库:', compositeDishes.length, '条')

  var baseResult = parseFoodInput(rawInput, foods, compositeDishes)
  if (baseResult.failed.length === 0) return baseResult

  console.log('[parseFoodInput] AI 层启动:', baseResult.failed)
  var aiResult = await processAISegments(baseResult.failed, foods, callDeepSeekDirect, db)

  var aiFailed = aiResult.failed.filter(function(f) { return f.ingredient === null }).map(function(f) { return f.segment })
  var aiMerged = aiResult.segmentResults.map(function(sr) { return sr.mergedItem }).filter(Boolean)

  console.log('[parseFoodInput] 返回, 总项:', baseResult.items.length + aiMerged.length)
  return { items: baseResult.items.concat(aiMerged), failed: aiFailed }
}
