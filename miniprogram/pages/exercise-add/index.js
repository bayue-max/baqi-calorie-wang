const api = require('../../services/cloud')

Page({
  data: {
    exercised: true,
    intensity: 'moderate_strength',
    duration: '',
    saving: false
  },

  setExercised(event) {
    this.setData({ exercised: event.currentTarget.dataset.value === 'true' })
  },

  selectIntensity(event) {
    this.setData({ intensity: event.currentTarget.dataset.value })
  },

  updateDuration(event) {
    this.setData({ duration: event.detail.value })
  },

  async submit() {
    if (!this.data.exercised) {
      wx.navigateBack()
      return
    }

    const duration = Number(this.data.duration)
    if (!duration || duration <= 0) {
      wx.showToast({ title: '请输入运动时长', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      await api.addExerciseRecord({
        userId: getApp().globalData.userId,
        intensity: this.data.intensity,
        duration
      })
      wx.navigateBack()
    } catch (error) {
      wx.showToast({ title: error.message || '添加失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
