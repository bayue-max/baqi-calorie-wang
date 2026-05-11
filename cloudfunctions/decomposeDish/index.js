/**
 * decomposeDish 云函数
 *
 * 通过 DeepSeek API 将复合菜品名称分解为基础食材清单。
 *
 * API Key 读取优先级（高 → 低）：
 *   1. 云开发环境变量 DEEPSEEK_API_KEY
 *   2. 本地 config.local.js 文件
 */

const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

let DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
if (!DEEPSEEK_API_KEY) {
  try {
    const local = require('./config.local')
    DEEPSEEK_API_KEY = local.DEEPSEEK_API_KEY
  } catch (e) { /* ignore */ }
}

const DEEPSEEK_API_HOST = 'api.deepseek.com'
const DEEPSEEK_API_PATH = '/v1/chat/completions'
const HTTP_TIMEOUT = 4000

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

function httpsPost(host, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = https.request({
      hostname: host,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: HTTP_TIMEOUT
    }, (res) => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(d)) }
          catch (e) { reject(new Error('Parse fail')) }
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
 * 标准化 DeepSeek 返回结果
 * 处理中英文字段名混用的情况
 */
function normalizeResult(raw, dishName) {
  const fields = raw.dishName || raw.菜品 || raw.dish_name || dishName
  const confidence = raw.confidence || raw.置信度 || 'medium'
  const oilIncluded = raw.oilIncluded || raw.油已计入 || raw.oil_included || false
  const servingEstimate = raw.servingEstimate || raw.估算份量 || raw.serving_estimate || false

  let ingredients = raw.ingredients || raw.食材 || raw.ingredient_list || []
  ingredients = ingredients.map(ing => {
    if (typeof ing === 'string') return { name: ing, weight: 100, unit: 'g' }
    return {
      name: ing.name || ing.名称 || ing.食材 || ing.food || '未知',
      weight: ing.weight || ing.重量 || ing.重量_g || ing.grams || 100,
      unit: ing.unit || ing.单位 || 'g'
    }
  })

  return {
    dishName: fields,
    confidence: confidence,
    oilIncluded: !!oilIncluded,
    ingredients,
    servingEstimate: !!servingEstimate,
    fromAI: true
  }
}

exports.main = async (event) => {
  const { dishName } = event
  if (!dishName) throw new Error('Missing dishName')
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured')

  try {
    const body = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: DECOMPOSE_PROMPT },
        { role: 'user', content: dishName }
      ],
      temperature: 0.1,
      max_tokens: 300
    }

    const result = await httpsPost(DEEPSEEK_API_HOST, DEEPSEEK_API_PATH, body)
    const content = JSON.parse(result.choices[0].message.content)
    return normalizeResult(content, dishName)

  } catch (error) {
    console.error('[decomposeDish]', dishName, error.message)
    throw error
  }
}
