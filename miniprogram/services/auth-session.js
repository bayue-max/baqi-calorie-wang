const AUTH_SESSION_KEY = 'baqi_calorie_auth_session'

function normalizeSession(value) {
  if (!value || !value.userId) return null
  return {
    userId: value.userId,
    profileCompleted: Boolean(value.profileCompleted),
    privacyAgreed: Boolean(value.privacyAgreed)
  }
}

function readAuthSession(storage = wx) {
  try {
    return normalizeSession(storage.getStorageSync(AUTH_SESSION_KEY))
  } catch (error) {
    return null
  }
}

function saveAuthSession({ user, privacyAgreed }, storage = wx) {
  var session = normalizeSession({
    userId: user && user._id,
    profileCompleted: user && user.profileCompleted,
    privacyAgreed
  })
  if (!session) return null
  storage.setStorageSync(AUTH_SESSION_KEY, session)
  return session
}

function applyAuthSessionToApp(session, app = getApp()) {
  if (!session || !app || !app.globalData) return
  app.globalData.userId = session.userId
  app.globalData.profileCompleted = session.profileCompleted
  app.globalData.privacyAgreed = session.privacyAgreed
}

function getResumeTarget(session) {
  if (!session || !session.userId) return ''
  return session.profileCompleted ? '/pages/home/index' : '/pages/profile-edit/index'
}

module.exports = {
  AUTH_SESSION_KEY,
  applyAuthSessionToApp,
  getResumeTarget,
  readAuthSession,
  saveAuthSession
}
