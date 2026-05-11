const api = require('../../services/cloud')
const { applyAuthSessionToApp, saveAuthSession } = require('../../services/auth-session')
const { clearPageCache } = require('../../services/page-cache')

Page({
  data: {
    nickname: '',
    avatarUrl: '',
    gender: 'male',
    age: '',
    height: '',
    weight: '',
    goal: 'fat_loss',
    loading: true,
    saving: false
  },

  onLoad() {
    this.loadProfile()
  },

  async loadProfile() {
    const userId = getApp().globalData.userId
    if (!userId) {
      this.setData({ loading: false })
      return
    }
    try {
      const { user } = await api.getProfile({ userId })
      if (user && user.profileCompleted) {
        this.setData({
          nickname: user.nickname || '',
          avatarUrl: user.avatarUrl || '',
          gender: user.gender || 'male',
          age: user.age || '',
          height: user.height || '',
          weight: user.weight || '',
          goal: user.goal || 'fat_loss'
        })
      }
    } catch (error) {
      if (!getApp().globalData.useMock) {
        wx.showToast({ title: '资料读取失败', icon: 'none' })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  updateField(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value })
  },

  selectOption(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.currentTarget.dataset.value })
  },

  isComplete(payload) {
    return payload.nickname && payload.gender && payload.age && payload.height &&
      payload.weight && payload.goal
  },

  async save() {
    const payload = {
      nickname: this.data.nickname,
      avatarUrl: this.data.avatarUrl,
      gender: this.data.gender,
      age: Number(this.data.age),
      height: Number(this.data.height),
      weight: Number(this.data.weight),
      goal: this.data.goal
    }

    if (!this.isComplete(payload)) {
      wx.showToast({ title: '请完整填写资料', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      const { user } = await api.saveProfile({
        userId: getApp().globalData.userId,
        profile: payload
      })
      const session = saveAuthSession({ user, privacyAgreed: true })
      applyAuthSessionToApp(session)
      clearPageCache('home')
      clearPageCache('profile')
      clearPageCache('stats:week')
      clearPageCache('stats:month')
      wx.switchTab({ url: '/pages/profile/index' })
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
