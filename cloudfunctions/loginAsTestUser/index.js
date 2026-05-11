const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async () => {
  const now = Date.now()
  const testPhone = 'test-user'
  const existing = await db.collection('users').where({
    accountType: 'test',
    phone: testPhone
  }).limit(1).get()

  if (existing.data.length > 0) {
    return { user: existing.data[0], isNew: false }
  }

  const user = {
    accountType: 'test',
    phone: testPhone,
    openid: '',
    unionid: '',
    avatarUrl: '',
    defaultAvatarType: 'male',
    nickname: '测试用户',
    profileCompleted: false,
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection('users').add({ data: user })
  return { user: { ...user, _id: result._id }, isNew: true }
}
