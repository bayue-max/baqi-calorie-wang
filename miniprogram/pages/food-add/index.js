const api = require('../../services/cloud')

const FALLBACK_FOODS = [
  {
    foodId: 'chicken',
    name: '鸡胸肉',
    alias: ['鸡胸', '鸡肉'],
    caloriesPer100g: 120,
    proteinPer100g: 23,
    fatPer100g: 2.5,
    carbPer100g: 0,
    unitConversions: { g: 1, 克: 1, 份: 100 }
  },
  {
    foodId: 'rice',
    name: '米饭',
    alias: ['白米饭'],
    caloriesPer100g: 116,
    proteinPer100g: 2.6,
    fatPer100g: 0.3,
    carbPer100g: 25.9,
    unitConversions: { g: 1, 克: 1, 份: 150 }
  },
  {
    foodId: 'egg',
    name: '鸡蛋',
    alias: ['蛋'],
    caloriesPer100g: 140,
    proteinPer100g: 12,
    fatPer100g: 10,
    carbPer100g: 1,
    unitConversions: { g: 1, 克: 1, 个: 50 }
  }
]

function fallbackParse(rawInput) {
  const segments = rawInput
    .replace(/早餐|午餐|晚餐|加餐/g, '')
    .replace(/，|、|；|;/g, ',')
    .split(',')
    .flatMap(segment => segment.trim().includes(' ') ? segment.trim().split(/\s+/) : [segment.trim()])
    .filter(Boolean)
  const items = []
  const failed = []

  segments.forEach(segment => {
    const prefixMatch = segment.match(/^(\d+(?:\.\d+)?)\s*(kg|千克|g|克|ml|个|根|份)\s*(.+)$/)
    const suffixMatch = prefixMatch ? null : segment.match(/^(.+?)(\d+(?:\.\d+)?)?\s*(kg|千克|g|克|ml|个|根|份)?$/)
    const parsed = prefixMatch
      ? { nameText: prefixMatch[3].trim(), amount: Number(prefixMatch[1]), unit: prefixMatch[2], isDefaultAmount: false }
      : {
          nameText: suffixMatch ? suffixMatch[1].trim() : segment,
          amount: suffixMatch && suffixMatch[2] ? Number(suffixMatch[2]) : 100,
          unit: suffixMatch && suffixMatch[3] ? suffixMatch[3] : 'g',
          isDefaultAmount: !(suffixMatch && suffixMatch[2])
        }
    const food = FALLBACK_FOODS.find(item => {
      return item.name === parsed.nameText || item.alias.includes(parsed.nameText) || item.name.includes(parsed.nameText)
    })

    if (!food) {
      failed.push(parsed.nameText)
      return
    }

    const factor = parsed.unit === 'kg' || parsed.unit === '千克' ? 1000 : food.unitConversions[parsed.unit]
    if (!factor) {
      failed.push(parsed.nameText)
      return
    }

    const grams = parsed.amount * factor
    const ratio = grams / 100
    items.push({
      foodId: food.foodId,
      name: food.name,
      rawSegment: segment,
      amount: parsed.amount,
      unit: parsed.unit,
      gramEquivalent: Math.round(grams),
      isDefaultAmount: parsed.isDefaultAmount,
      calories: Math.round(food.caloriesPer100g * ratio),
      protein: Math.round(food.proteinPer100g * ratio),
      fat: Math.round(food.fatPer100g * ratio),
      carb: Math.round(food.carbPer100g * ratio)
    })
  })

  return { items, failed }
}

Page({
  data: {
    mealType: 'breakfast',
    rawInput: '',
    parsedItems: [
      {
        name: '硬编码测试',
        rawSegment: '硬编码测试',
        amount: 1,
        unit: '份',
        gramEquivalent: 200,
        calories: 200, 
        protein: 10,
        fat: 5,
        carb: 25,
        isDefaultAmount: false,
        fromAI: true,
        breakdown: [
          { name: '食材A', amount: 100, unit: 'g', calories: 120, estimated: false },
          { name: '食材B', amount: 50, unit: 'g', calories: 80, estimated: true }
        ]
      }
    ],
    failedItems: [],
    failedText: '',
    parsing: false,
    saving: false
  },

  selectMeal(event) {
    this.setData({ mealType: event.currentTarget.dataset.value })
  },

  updateInput(event) {
    this.setData({ rawInput: event.detail.value })
  },

  async parse() {
    if (!this.data.rawInput.trim()) {
      wx.showToast({ title: '请输入食物', icon: 'none' })
      return
    }
    this.setData({ parsing: true })
    try {
      let result = await api.parseFoodInput({ rawInput: this.data.rawInput })
      if (!result.items || result.items.length === 0) {
        result = fallbackParse(this.data.rawInput)
      }
      this.setData({
        parsedItems: result.items,
        failedItems: result.failed,
        failedText: result.failed.join('、')
      })
    } catch (error) {
      wx.showToast({ title: error.message || '解析失败', icon: 'none' })
    } finally {
      this.setData({ parsing: false })
    }
  },

  async confirmAdd() {
    if (this.data.parsedItems.length === 0) {
      wx.showToast({ title: '未识别到可计算的食物', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      await api.addFoodRecords({
        userId: getApp().globalData.userId,
        mealType: this.data.mealType,
        rawInput: this.data.rawInput,
        items: this.data.parsedItems
      })
      wx.navigateBack()
    } catch (error) {
      wx.showToast({ title: error.message || '添加失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
