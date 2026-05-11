const api = require('../../services/cloud')
const { getPageCache, setPageCache } = require('../../services/page-cache')

const STATS_CACHE_TTL = 60000

Page({
  data: {
    mode: 'week',
    stats: null,
    loading: true
  },

  onShow() {
    this.load()
  },

  async load() {
    const cacheKey = `stats:${this.data.mode}`
    const cached = getPageCache(cacheKey, STATS_CACHE_TTL)
    if (cached) {
      this.setData({ stats: cached, loading: false })
    }

    try {
      if (!getApp().globalData.userId) {
        if (!cached) this.setData({ loading: false })
        return
      }
      const stats = await api.getStats({
        userId: getApp().globalData.userId,
        mode: this.data.mode
      })
      setPageCache(cacheKey, stats)
      this.setData({ stats, loading: false })
    } catch (error) {
      if (!cached) this.setData({ loading: false })
    }
  },

  switchMode(event) {
    this.setData({ mode: event.currentTarget.dataset.mode }, () => this.load())
  }
})
