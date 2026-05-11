const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async event => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) {
    throw new Error('Missing wechat openid')
  }

  const now = Date.now()

  const existing = await db.collection('users').where({
    accountType: 'wechat',
    openid
  }).limit(1).get()

  if (existing.data.length > 0) {
    const user = existing.data[0]
    const patch = {
      unionid: wxContext.UNIONID || user.unionid || '',
      updatedAt: now
    }
    await db.collection('users').doc(user._id).update({ data: patch })
    return { user: { ...user, ...patch }, isNew: false }
  }

  const user = {
    accountType: 'wechat',
    phone: '',
    openid,
    unionid: wxContext.UNIONID || '',
    avatarUrl: '',
    defaultAvatarType: 'male',
    nickname: '',
    profileCompleted: false,
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection('users').add({ data: user })
  return { user: { ...user, _id: result._id }, isNew: true }
}
