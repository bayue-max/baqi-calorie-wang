const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { calculateUserPlan } = require('./shared/plan')
const { validateProfile } = require('./shared/validators')
const { getBeijingDateString } = require('./shared/date')
const { upsertDailySummary } = require('./shared/dailySummaryStore')

exports.main = async event => {
  const { userId, profile } = event
  if (!userId) throw new Error('Missing userId')
  validateProfile(profile)

  const now = Date.now()
  const defaultAvatarType = profile.gender === 'female' ? 'female' : 'male'
  const userPatch = {
    ...profile,
    defaultAvatarType,
    profileCompleted: true,
    updatedAt: now
  }
  await db.collection('users').doc(userId).update({ data: userPatch })

  const plan = {
    userId,
    ...calculateUserPlan(profile),
    updatedAt: now
  }

  const existingPlan = await db.collection('user_plan').where({ userId }).limit(1).get()
  let savedPlan
  if (existingPlan.data.length > 0) {
    await db.collection('user_plan').doc(existingPlan.data[0]._id).update({ data: plan })
    savedPlan = { ...existingPlan.data[0], ...plan }
  } else {
    const result = await db.collection('user_plan').add({ data: { ...plan, createdAt: now } })
    savedPlan = { _id: result._id, ...plan, createdAt: now }
  }

  const summary = await upsertDailySummary(db, userId, getBeijingDateString())
  return { user: { _id: userId, ...userPatch }, plan: savedPlan, summary }
}
