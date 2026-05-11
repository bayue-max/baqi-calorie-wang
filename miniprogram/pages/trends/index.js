const api = require('../../services/cloud')
const { getPageCache, setPageCache } = require('../../services/page-cache')

const STATS_CACHE_TTL = 60000

Page({
  data: {
    mode: 'week',
    stats: null,
    loading: true
  },

  onLoad() {
    this.load()
  },

  onShow() {
    if (getApp().globalData.userId) {
      this.load()
    }
  },

  async load() {
    const cacheKey = `stats:${this.data.mode}`
    const cached = getPageCache(cacheKey, STATS_CACHE_TTL)
    if (cached) {
      this.setData({ stats: cached, loading: false })
    } else {
      this.setData({ loading: true })
    }

    try {
      if (!getApp().globalData.userId) {
        this.setData({ loading: false })
        return
      }
      const stats = await api.getStats({
        userId: getApp().globalData.userId,
        mode: this.data.mode
      })
      setPageCache(cacheKey, stats)
      this.setData({
        stats,
        loading: false
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  switchMode(event) {
    this.setData({ mode: event.currentTarget.dataset.mode }, () => this.load())
  }
})
