/**
 * DeepSeek API 客户端（共享模块）
 *
 * 使用 Node.js 内置 https 模块，兼容所有 Node 版本。
 * 可直接在云函数中 require 使用，不需走 cloud.callFunction 嵌套调用。
 */

const https = require('https')

const API_HOST = 'api.deepseek.com'
const API_PATH = '/v1/chat/completions'
const HTTP_TIMEOUT = 2400

const DECOMPOSE_PROMPT = `分解菜品为食材+总营养，返回JSON：
{"dishName":"菜名","totalCalories":600,"totalProtein":18,"totalFat":22,"totalCarb":80,"confidence":"high","oilIncluded":true,"servingEstimate":false,"ingredients":[{"name":"食材","weight":200,"unit":"g"}]}

规则：1~6种核心食材，食材输出name/weight/unit/calories/protein/fat/carb。total营养为整道菜估算（含酱料调料）。有克重/数量以此为基准，无则设servingEstimate=true。用英语字段名。

示例：
红烧肉200g→{"dishName":"红烧肉","totalCalories":880,"totalProtein":26,"totalFat":84,"totalCarb":0,"confidence":"high","oilIncluded":true,"servingEstimate":false,"ingredients":[{"name":"五花肉","weight":200,"unit":"g"},{"name":"食用油","weight":10,"unit":"g"}]}`

/**
 * HTTPS POST 请求封装
 */
function httpsPost(host, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = https.request({
      hostname: host,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: HTTP_TIMEOUT
    }, (res) => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(d)) }
          catch (e) { reject(new Error('Parse response failed')) }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
    req.write(data)
    req.end()
  })
}

function parseNum(v) { if (v == null) return null; if (typeof v === 'number') return isNaN(v) ? null : v; if (typeof v !== 'string') { var n = parseFloat(String(v)); return isNaN(n) ? null : n; } var s = v.replace(/[^0-9.]/g, ''); var r = parseFloat(s); return isNaN(r) || s === '' ? null : r; }

function normalizeResult(raw, dishName) {
  var dish = raw
  if (raw && raw.dishes && raw.dishes.length > 0) dish = raw.dishes[0]

  var name = (dish && (dish.dishName || dish.name)) || (raw && raw.dishName) || dishName
  var ingredients = (dish && dish.ingredients) || (raw && raw.ingredients) || (raw && raw.食材) || []
  ingredients = ingredients.map(function(ing) {
    var nut = (ing && ing.nutrition) || (ing && ing.营养) || {}
    return {
      name: (ing && (ing.name || ing.名称 || ing.食材 || ing.food)) || '未知',
      weight: parseNum(ing && (ing.weight || ing.重量 || ing.quantity || ing.数量 || ing.重量_g || ing.grams)),
      unit: (ing && (ing.unit || ing.单位)) || 'g',
      calories: parseNum(ing && (ing.calories || (nut && (nut.calories || nut.热量 || nut.卡路里)))),
      protein: parseNum(ing && (ing.protein || (nut && (nut.protein || nut.蛋白质)))),
      fat: parseNum(ing && (ing.fat || (nut && (nut.fat || nut.脂肪)))),
      carb: parseNum(ing && (ing.carb || ing.carbs || (nut && (nut.carbohydrates || nut.carb || nut.碳水))))
    }
  })

  var total = (dish && dish.total_nutrition) || (dish && dish.totalNutrition) || raw || {}
  return {
    dishName: name,
    confidence: String((raw && raw.confidence) || (dish && dish.confidence) || 'medium').toLowerCase(),
    oilIncluded: !!(raw && raw.oilIncluded),
    ingredients: ingredients,
    servingEstimate: !!(raw && raw.servingEstimate),
    totalCalories: parseNum((total && total.calories) || (raw && raw.totalCalories)) || 0,
    totalProtein: parseNum((total && total.protein) || (raw && raw.totalProtein)) || 0,
    totalFat: parseNum((total && total.fat) || (raw && raw.totalFat)) || 0,
    totalCarb: parseNum((total && (total.carbohydrates || total.carb)) || (raw && raw.totalCarb)) || 0,
    fromAI: true
  }
}

/**
 * 调用 DeepSeek 分解菜品
 *
 * @param {string} apiKey - DeepSeek API Key
 * @param {string} dishName - 菜品名称（如 "红烧肉" 或 "红烧肉200g"）
 * @returns {Promise<object>} 标准化后的分解结果
 */
async function callDeepSeek(apiKey, dishName) {
  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: DECOMPOSE_PROMPT },
      { role: 'user', content: dishName }
    ],
    temperature: 0.1,
    max_tokens: 150
  }

  const result = await httpsPost(API_HOST, API_PATH, body, apiKey)
  const content = JSON.parse(result.choices[0].message.content)
  return normalizeResult(content, dishName)
}

module.exports = {
  callDeepSeek,
  normalizeResult
}
