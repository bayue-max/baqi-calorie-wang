/**
 * DeepSeek API 客户端（共享模块）
 *
 * 使用 Node.js 内置 https 模块，兼容所有 Node 版本。
 * 可直接在云函数中 require 使用，不需走 cloud.callFunction 嵌套调用。
 */

const https = require('https')

const API_HOST = 'api.deepseek.com'
const API_PATH = '/v1/chat/completions'
const HTTP_TIMEOUT = 2500

const DECOMPOSE_PROMPT = `将菜品名称分解为超市能买到的基础食材，返回JSON。

输出格式必须严格如下，不要加markdown代码块：
{"dishName":"菜名","confidence":"high","oilIncluded":false,"ingredients":[{"name":"食材名","weight":200,"unit":"g"}],"servingEstimate":false}

规则：
- 每道菜分解为1~6种基础食材
- 用户提供重量时分配给主食材，没提供时估算并设servingEstimate为true
- 炒菜默认加10g食用油，油炸加25g，仅额外添加的油才列出
- 食材本身脂肪不算食用油
- 用英语字段名

示例：
红烧肉200g → {"dishName":"红烧肉","confidence":"high","oilIncluded":true,"ingredients":[{"name":"五花肉","weight":200,"unit":"g"},{"name":"食用油","weight":10,"unit":"g"}],"servingEstimate":false}
番茄炒蛋 → {"dishName":"番茄炒蛋","confidence":"high","oilIncluded":true,"ingredients":[{"name":"番茄","weight":150,"unit":"g"},{"name":"鸡蛋","weight":100,"unit":"g"},{"name":"食用油","weight":10,"unit":"g"}],"servingEstimate":true}`

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

/**
 * 标准化 DeepSeek 返回结果（兼容中英文混合字段名）
 */
function normalizeResult(raw, dishName) {
  const name = raw.dishName || raw.菜品 || raw.dish_name || dishName
  const confidence = raw.confidence || raw.置信度 || 'medium'
  const oilIncluded = raw.oilIncluded || raw.油已计入 || false
  const servingEstimate = raw.servingEstimate || raw.估算份量 || false

  let ingredients = raw.ingredients || raw.食材 || raw.ingredient_list || []
  ingredients = ingredients.map(ing => ({
    name: ing.name || ing.名称 || ing.食材 || ing.food || '未知',
    weight: ing.weight || ing.重量 || ing.重量_g || ing.grams || 100,
    unit: ing.unit || ing.单位 || 'g'
  }))

  return {
    dishName: name,
    confidence: String(confidence).toLowerCase(),
    oilIncluded: !!oilIncluded,
    ingredients,
    servingEstimate: !!servingEstimate,
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
    max_tokens: 300
  }

  const result = await httpsPost(API_HOST, API_PATH, body, apiKey)
  const content = JSON.parse(result.choices[0].message.content)
  return normalizeResult(content, dishName)
}

module.exports = {
  callDeepSeek,
  normalizeResult
}
