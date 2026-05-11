const api = require('../../services/cloud')
const {
  applyAuthSessionToApp,
  getResumeTarget,
  readAuthSession,
  saveAuthSession
} = require('../../services/auth-session')

Page({
  data: {
    loading: false,
    privacyAgreed: false,
    fullMode: false
  },

  onLoad(options) {
    var fullMode = !!(options && options.mode === 'full')
    var session = readAuthSession()
    if (session) {
      applyAuthSessionToApp(session)
      this.setData({ privacyAgreed: session.privacyAgreed })
      var target = getResumeTarget(session)
      if (target === '/pages/home/index') {
        wx.switchTab({ url: target })
      } else if (target) {
        wx.redirectTo({ url: target })
      }
      return
    }
    this.setData({ fullMode: fullMode })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  },

  async loginWithWechat() {
    await this.login(() => api.loginByWechatPhone())
  },

  openAgreement() {
    wx.navigateTo({ url: '/pages/agreement/index' })
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/index' })
  },

  togglePrivacyAgree() {
    this.setData({ privacyAgreed: !this.data.privacyAgreed })
  },

  async login(loginAction) {
    if (!this.data.privacyAgreed) {
      wx.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      var avatarUrl = ''
      try {
        var info = await new Promise(function(r) { wx.getUserInfo({ success: r, fail: r }) })
        avatarUrl = (info && info.userInfo && info.userInfo.avatarUrl) || ''
      } catch (e) {}

      const { user } = await loginAction()
      const session = saveAuthSession({ user, privacyAgreed: this.data.privacyAgreed, avatarUrl: avatarUrl })
      applyAuthSessionToApp(session)
      wx.redirectTo({ url: '/pages/profile-edit/index' })
    } catch (error) {
      wx.showToast({ title: error.message || '登录失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
