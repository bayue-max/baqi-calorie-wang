/**
 * 烹饪方法库
 *
 * 每个方法包含：
 * - labels: 触发识别的关键词
 * - heatType: 热量影响分类
 * - oilEstimate: 额外用油估算（克），用于炒/煎/炸等
 * - waterGainFactor: 含水率变化系数（煮/蒸后的重量变化），默认 1
 */

const COOKING_METHODS = {
  // ── 干热法：明显增加热量 ──
  炒: {
    labels: ['炒', '爆炒'],
    heatType: 'added_oil',
    oilEstimate: 10,
    waterGainFactor: 0.85
  },
  煎: {
    labels: ['煎', '干煎', '香煎'],
    heatType: 'added_oil',
    oilEstimate: 12,
    waterGainFactor: 0.75
  },
  炸: {
    labels: ['炸', '油炸', '酥炸', '干炸'],
    heatType: 'added_oil',
    oilEstimate: 25,
    waterGainFactor: 0.65
  },
  烤: {
    labels: ['烤', '烘烤', '炙烤', '烧烤', '炭烤'],
    heatType: 'removed_moisture',
    oilEstimate: 6,
    waterGainFactor: 0.7
  },
  红烧: {
    labels: ['红烧', '焖烧'],
    heatType: 'added_oil',
    oilEstimate: 12,
    waterGainFactor: 0.9
  },
  干煸: {
    labels: ['干煸'],
    heatType: 'added_oil',
    oilEstimate: 15,
    waterGainFactor: 0.6
  },

  // ── 湿热法：基本不增加热量 ──
  蒸: {
    labels: ['蒸', '清蒸'],
    heatType: 'moist_heat',
    oilEstimate: 0,
    waterGainFactor: 1.05
  },
  煮: {
    labels: ['煮', '水煮', '白煮'],
    heatType: 'moist_heat',
    oilEstimate: 0,
    waterGainFactor: 1.1
  },
  白灼: {
    labels: ['白灼'],
    heatType: 'moist_heat',
    oilEstimate: 0,
    waterGainFactor: 1.0
  },
  焯: {
    labels: ['焯', '汆'],
    heatType: 'moist_heat',
    oilEstimate: 0,
    waterGainFactor: 1.0
  },
  炖: {
    labels: ['炖', '煲', '慢炖'],
    heatType: 'moist_heat',
    oilEstimate: 0,
    waterGainFactor: 1.0
  },
  焖: {
    labels: ['焖'],
    heatType: 'moist_heat',
    oilEstimate: 0,
    waterGainFactor: 0.95
  },

  // ── 冷加工 ──
  凉拌: {
    labels: ['凉拌', '拌'],
    heatType: 'added_oil',
    oilEstimate: 8,
    waterGainFactor: 1.0
  },
  生: {
    labels: ['刺身', '生'],
    heatType: 'raw',
    oilEstimate: 0,
    waterGainFactor: 1.0
  }
}

/**
 * 检测文本中是否包含烹饪方法关键词
 * @param {string} text - 用户输入的段落文本
 * @returns {null|{method: string, config: object}}
 */
function detectCookingMethod(text) {
  for (const [method, config] of Object.entries(COOKING_METHODS)) {
    for (const label of config.labels) {
      if (text.startsWith(label) || text.includes(label)) {
        return { method, config }
      }
    }
  }
  return null
}

/**
 * 剥离烹饪关键词后提取基础食材名
 * @param {string} text - 用户输入的段落文本
 * @param {null|{method: string, config: object}} cookingMethod - detectCookingMethod 的结果
 * @returns {string} - 剥离后的食材名
 */
function extractBaseFoodName(text, cookingMethod) {
  if (!cookingMethod) return text.trim()
  // 去掉开头的烹饪关键词
  for (const label of cookingMethod.config.labels) {
    if (text.startsWith(label)) {
      return text.slice(label.length).trim()
    }
  }
  return text.trim()
}

/**
 * 计算烹饪用油带来的额外热量
 * 食用油约 9 kcal/g
 * @param {object|null} methodConfig - 烹饪方法的 config 对象
 * @returns {number} - 额外热量（千卡）
 */
function calculateOilCalories(methodConfig) {
  if (!methodConfig || !methodConfig.oilEstimate) return 0
  return Math.round(methodConfig.oilEstimate * 9)
}

module.exports = {
  COOKING_METHODS,
  detectCookingMethod,
  extractBaseFoodName,
  calculateOilCalories
}
