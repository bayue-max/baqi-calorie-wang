const { calculateDailySummary } = require('./summary')
const { calculateUserPlan } = require('./plan')

async function ensureUserPlan(db, userId) {
  const userResult = await db.collection('users').doc(userId).get()
  const user = userResult.data
  if (!user) {
    throw new Error('Missing user')
  }

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

async function upsertDailySummary(db, userId, date) {
  const plan = await ensureUserPlan(db, userId)
  const records = (await db.collection('daily_records').where({ userId, date }).get()).data
  const summary = {
    userId,
    date,
    ...calculateDailySummary(records, plan),
    updatedAt: Date.now()
  }

  const existing = await db.collection('daily_summary').where({ userId, date }).limit(1).get()
  if (existing.data.length > 0) {
    await db.collection('daily_summary').doc(existing.data[0]._id).update({ data: summary })
    return { ...existing.data[0], ...summary }
  }

  const result = await db.collection('daily_summary').add({ data: summary })
  return { _id: result._id, ...summary }
}

module.exports = {
  ensureUserPlan,
  upsertDailySummary
}
