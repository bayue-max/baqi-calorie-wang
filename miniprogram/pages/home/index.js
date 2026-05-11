const api = require('../../services/cloud')
const { clearPageCache, getPageCache, setPageCache } = require('../../services/page-cache')

const HOME_CACHE_KEY = 'home'
const HOME_CACHE_TTL = 60000

const MEAL_LABELS = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
  exercise: '运动'
}

const MEAL_ICON = {
  breakfast: '/assets/icons/home/meal-breakfast.svg',
  lunch: '/assets/icons/home/meal-lunch.svg',
  dinner: '/assets/icons/home/meal-dinner.svg',
  snack: '/assets/icons/home/meal-snack.svg'
}

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
    loading: true,
    summary: null,
    records: [],
    mealGroups: [],
    exerciseGroup: null,
    showRecordTable: false,
    showFoodModal: false,
    foodMealType: 'breakfast',
    foodRawInput: '',
    foodParsedItems: [],
    foodFailedItems: [],
    foodFailedText: '',
    foodParsing: false,
    foodSaving: false,
    showExerciseModal: false,
    exerciseIntensity: 'moderate_strength',
    exerciseDuration: '',
    exerciseSaving: false
  },

  onShow() {
    this.load()
  },

  async load() {
    const cached = getPageCache(HOME_CACHE_KEY, HOME_CACHE_TTL)
    if (cached) {
      this.applyHomeData(cached)
    }

    var userId = getApp().globalData.userId
    if (!userId) {
      this.setData({
        loading: false,
        summary: this.normalizeSummary({
          remainingCalories: 2000, foodCalories: 0, dynamicTargetCalories: 2000,
          foodProgressPercent: 0, foodProgressWidth: '0%',
          bmr: 1600, coachText: '霸气等你上线！',
          proteinTotal: 0, dynamicProteinTarget: 100, proteinProgressPercent: '0%', proteinProgressWidth: '0%',
          fatTotal: 0, dynamicFatTarget: 55, fatProgressPercent: '0%', fatProgressWidth: '0%',
          carbTotal: 0, dynamicCarbTarget: 230, carbProgressPercent: '0%', carbProgressWidth: '0%'
        }),
        records: [],
        mealGroups: [],
        exerciseGroup: null
      })
      return
    }

    try {
      const data = await api.getHomeData({ userId })
      setPageCache(HOME_CACHE_KEY, data)
      this.applyHomeData(data)
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  applyHomeData(data) {
    this.setData({
      loading: false,
      summary: this.normalizeSummary(data.summary),
      records: this.normalizeRecords(data.records),
      mealGroups: this.groupMealRecords(data.records),
      exerciseGroup: this.groupExerciseRecords(data.records)
    })
    this.prefetchOtherPages()
  },

  prefetchOtherPages() {
    const userId = getApp().globalData.userId
    if (!userId) return
    api.getProfile({ userId }).then(data => {
      setPageCache('profile', data)
    }).catch(() => {})
    api.getStats({ userId, mode: 'week' }).then(stats => {
      setPageCache('stats:week', stats)
    }).catch(() => {})
    api.getStats({ userId, mode: 'month' }).then(stats => {
      setPageCache('stats:month', stats)
    }).catch(() => {})
  },

  normalizeRecords(records) {
    return (records || []).map(record => {
      const base = {
        ...record,
        displayMealType: MEAL_LABELS[record.mealType] || record.mealType,
        recordTone: record.recordType === 'exercise' ? 'record-exercise' : 'record-food',
        displayCalories: record.recordType === 'exercise' ? `${record.calories} kcal` : `${record.calories} kcal`,
        displayName: record.name,
        displayAmount: `${record.amount}${record.unit}`,
        displayProtein: record.recordType === 'exercise' ? '-' : record.protein,
        displayFat: record.recordType === 'exercise' ? '-' : record.fat,
        displayCarb: record.recordType === 'exercise' ? '-' : record.carb
      }
      if (record.recordType !== 'exercise') return base
      return {
        ...base,
        displayMealType: MEAL_LABELS.exercise,
        displayName: String(record.name || '').replace(/\s*\d+(?:\.\d+)?min$/, ''),
        displayAmount: record.duration ? `${record.duration}min` : '-'
      }
    })
  },

  normalizeFoodRecord(record) {
    return {
      ...record,
      displayAmount: `${record.amount}${record.unit}`,
      displayCalories: `${record.calories} kcal`
    }
  },

  groupMealRecords(records) {
    const groups = {}
    ;(records || []).forEach(record => {
      if (record.recordType === 'exercise') return
      const key = record.mealType || 'snack'
      if (!groups[key]) {
        groups[key] = {
          key,
          label: MEAL_LABELS[key] || key,
          icon: MEAL_ICON[key] || MEAL_ICON.lunch,
          calories: 0,
          records: []
        }
      }
      groups[key].calories += Number(record.calories) || 0
      groups[key].records.push(this.normalizeFoodRecord(record))
    })
    return ['breakfast', 'lunch', 'dinner', 'snack']
      .map(key => groups[key])
      .filter(Boolean)
  },

  groupExerciseRecords(records) {
    const items = (records || [])
      .filter(record => record.recordType === 'exercise')
      .map(record => ({
        ...record,
        displayName: String(record.name || '').replace(/\s*\d+(?:\.\d+)?min$/, ''),
        displayAmount: record.duration ? `${record.duration} min` : '-',
        displayCalories: `${record.calories} kcal`
      }))
    if (!items.length) return null
    return {
      label: '运动',
      calories: items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0),
      records: items
    }
  },

  normalizeSummary(summary) {
    if (!summary) return summary
    const percent = (value, target) => {
      const safeTarget = Number(target) || 1
      const ratio = Math.max(0, Math.min(100, Math.round((Number(value) || 0) / safeTarget * 100)))
      return `${ratio}%`
    }
    const percentNumber = (value, target) => {
      const safeTarget = Number(target) || 1
      return Math.max(0, Math.min(100, Math.round((Number(value) || 0) / safeTarget * 100)))
    }
    const foodPercent = percentNumber(summary.foodCalories, summary.dynamicTargetCalories)
    const remaining = Number(summary.remainingCalories) || 0
    const coachText = remaining >= 1000
      ? '干得不错，继续保持！'
      : remaining >= 300
        ? '稳住节奏，别乱加餐。'
        : '霸气盯紧了，少吃点。'

    return {
      ...summary,
      foodProgressPercent: foodPercent,
      foodProgressWidth: percent(summary.foodCalories, summary.dynamicTargetCalories),
      proteinProgressWidth: percent(summary.proteinTotal, summary.dynamicProteinTarget),
      fatProgressWidth: percent(summary.fatTotal, summary.dynamicFatTarget),
      carbProgressWidth: percent(summary.carbTotal, summary.dynamicCarbTarget),
      proteinProgressPercent: percentNumber(summary.proteinTotal, summary.dynamicProteinTarget),
      fatProgressPercent: percentNumber(summary.fatTotal, summary.dynamicFatTarget),
      carbProgressPercent: percentNumber(summary.carbTotal, summary.dynamicCarbTarget),
      coachText
    }
  },

  openFoodModal() {
    this.setData({
      showFoodModal: true,
      foodMealType: 'breakfast',
      foodRawInput: '',
      foodParsedItems: [],
      foodFailedItems: [],
      foodFailedText: ''
    })
  },

  closeFoodModal() {
    if (this.data.foodParsing || this.data.foodSaving) return
    this.setData({ showFoodModal: false })
  },

  selectFoodMeal(event) {
    this.setData({ foodMealType: event.currentTarget.dataset.value })
  },

  updateFoodInput(event) {
    this.setData({ foodRawInput: event.detail.value })
  },

  async parseFood() {
    if (!this.data.foodRawInput.trim()) {
      wx.showToast({ title: '请输入食物', icon: 'none' })
      return
    }

    this.setData({ foodParsing: true })
    try {
      let result = await api.parseFoodInput({ rawInput: this.data.foodRawInput })
      if (!result.items || result.items.length === 0) {
        result = fallbackParse(this.data.foodRawInput)
      }
      this.setData({
        foodParsedItems: result.items,
        foodFailedItems: result.failed,
        foodFailedText: result.failed.join('、')
      })
    } catch (error) {
      wx.showToast({ title: error.message || '解析失败', icon: 'none' })
    } finally {
      this.setData({ foodParsing: false })
    }
  },

  async saveFood() {
    if (!getApp().globalData.userId) {
      wx.navigateTo({ url: '/pages/login/index?mode=full' })
      return
    }
    if (this.data.foodParsedItems.length === 0) {
      wx.showToast({ title: '未识别到可计算的食物', icon: 'none' })
      return
    }

    this.setData({ foodSaving: true })
    try {
      await api.addFoodRecords({
        userId: getApp().globalData.userId,
        mealType: this.data.foodMealType,
        rawInput: this.data.foodRawInput,
        items: this.data.foodParsedItems
      })
      this.clearDataCaches()
      this.setData({
        showFoodModal: false,
        foodRawInput: '',
        foodParsedItems: [],
        foodFailedItems: [],
        foodFailedText: ''
      })
      this.load()
    } catch (error) {
      wx.showToast({ title: error.message || '添加失败', icon: 'none' })
    } finally {
      this.setData({ foodSaving: false })
    }
  },

  openExerciseModal() {
    this.setData({
      showExerciseModal: true,
      exerciseIntensity: 'moderate_strength',
      exerciseDuration: ''
    })
  },

  closeExerciseModal() {
    if (this.data.exerciseSaving) return
    this.setData({ showExerciseModal: false })
  },

  noop() {},

  selectExerciseIntensity(event) {
    this.setData({ exerciseIntensity: event.currentTarget.dataset.value })
  },

  updateExerciseDuration(event) {
    this.setData({ exerciseDuration: event.detail.value })
  },

  async saveExercise() {
    if (!getApp().globalData.userId) {
      wx.navigateTo({ url: '/pages/login/index?mode=full' })
      return
    }
    const duration = Number(this.data.exerciseDuration)
    if (!duration || duration <= 0) {
      wx.showToast({ title: '请输入运动时长', icon: 'none' })
      return
    }

    this.setData({ exerciseSaving: true })
    try {
      await api.addExerciseRecord({
        userId: getApp().globalData.userId,
        intensity: this.data.exerciseIntensity,
        duration
      })
      this.clearDataCaches()
      this.setData({
        showExerciseModal: false,
        exerciseDuration: ''
      })
      this.load()
    } catch (error) {
      wx.showToast({ title: error.message || '添加失败', icon: 'none' })
    } finally {
      this.setData({ exerciseSaving: false })
    }
  },

  goTrends() {
    wx.switchTab({ url: '/pages/trends/index' })
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/index' })
  },

  toggleRecordTable() {
    this.setData({ showRecordTable: !this.data.showRecordTable })
  },

  async deleteRecord(event) {
    const recordId = event.currentTarget.dataset.id
    try {
      await api.deleteRecord({ recordId })
      this.clearDataCaches()
      this.load()
    } catch (error) {
      wx.showToast({ title: error.message || '删除失败', icon: 'none' })
    }
  },

  clearDataCaches() {
    clearPageCache(HOME_CACHE_KEY)
    clearPageCache('stats:week')
    clearPageCache('stats:month')
  }
})
