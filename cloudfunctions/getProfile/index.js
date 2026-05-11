const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { calculateUserPlan } = require('./shared/plan')

async function ensureUserPlan(userId, user) {
  const now = Date.now()
  const planPatch = {
    userId,
    ...calculateUserPlan(user),
    updatedAt: now
  }
  const existingPlan = await db.collection('user_plan').where({ userId }).limit(1).get()
  if (existingPlan.data.length > 0) {
    await db.collection('user_plan').doc(existingPlan.data[0]._id).update({ data: planPatch })
    return { ...existingPlan.data[0], ...planPatch }
  }

  const result = await db.collection('user_plan').add({ data: { ...planPatch, createdAt: now } })
  return { _id: result._id, ...planPatch, createdAt: now }
}

exports.main = async event => {
  const { userId } = event
  if (!userId) throw new Error('Missing userId')
  const user = await db.collection('users').doc(userId).get()
  const plan = user.data && user.data.profileCompleted
    ? await ensureUserPlan(userId, user.data)
    : null
  return { user: user.data, plan }
}
