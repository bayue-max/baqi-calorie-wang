const api = require('../../services/cloud')
const { getPageCache, setPageCache } = require('../../services/page-cache')

const PROFILE_CACHE_KEY = 'profile'
const PROFILE_CACHE_TTL = 60000

const GENDER_LABELS = { male: '男', female: '女' }
const GOAL_LABELS = { fat_loss: '减脂', maintain: '维持', muscle_gain: '增肌' }
const PROTEIN_FACTORS = { fat_loss: 2.0, maintain: 1.6, muscle_gain: 1.8 }

const COACH_PROFILE = {
  user: { nickname: '霸气教练', gender: 'male', age: 6, height: 55, weight: 9, goal: 'maintain', profileCompleted: false },
  plan: { targetCalories: 2000, bmr: 1600, habitBurn: 300, calorieAdjustment: 100, proteinTarget: 100, fatTarget: 55, carbTarget: 230 }
}

Page({
  data: { user: null, plan: null, display: null, loading: true, showFormula: false },

  onShow() { this.load() },

  async load() {
    const cached = getPageCache(PROFILE_CACHE_KEY, PROFILE_CACHE_TTL)
    if (cached) { this.applyProfileData(cached) }

    var userId = getApp().globalData.userId
    if (!userId) {
      this.setData({
        user: COACH_PROFILE.user,
        plan: COACH_PROFILE.plan,
        display: this.buildDisplay(COACH_PROFILE.user, COACH_PROFILE.plan),
        loading: false
      })
      return
    }

    try {
      var data = await api.getProfile({ userId: userId })
      setPageCache(PROFILE_CACHE_KEY, data)
      this.applyProfileData(data)
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  applyProfileData(data) {
    this.setData({ user: data.user, plan: data.plan, display: this.buildDisplay(data.user, data.plan), loading: false })
  },

  buildDisplay(user, plan) {
    if (!user) return null
    var proteinFactor = PROTEIN_FACTORS[user.goal]
    return {
      gender: GENDER_LABELS[user.gender] || user.gender || '-',
      goal: GOAL_LABELS[user.goal] || user.goal || '-',
      proteinNote: proteinFactor ? '按体重 ' + proteinFactor + ' 倍计算' : '',
      fatNote: plan ? '按建议摄入 25% 计算' : '',
      carbNote: plan ? '按剩余热量计算' : ''
    }
  },

  toggleFormula() {
    this.setData({ showFormula: !this.data.showFormula })
  },

  edit() {
    if (!getApp().globalData.userId) {
      wx.navigateTo({ url: '/pages/login/index?mode=full' })
      return
    }
    wx.navigateTo({ url: '/pages/profile-edit/index' })
  }
})
