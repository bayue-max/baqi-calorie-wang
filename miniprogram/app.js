const { applyAuthSessionToApp, readAuthSession } = require('./services/auth-session')

App({
  globalData: {
    envId: 'cloud1-d8gst9c720f701e31',
    useMock: false,
    userId: '',
    profileCompleted: false,
    privacyAgreed: false
  },

  onLaunch() {
    applyAuthSessionToApp(readAuthSession(), this)

    if (wx.cloud) {
      wx.cloud.init({
        env: this.globalData.envId || undefined,
        traceUser: true
      })
    }
  }
})
