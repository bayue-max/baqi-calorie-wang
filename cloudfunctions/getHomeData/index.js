const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { getBeijingDateString } = require('./shared/date')
const { calculateDailySummary } = require('./shared/summary')
const { ensureUserPlan } = require('./shared/dailySummaryStore')

exports.main = async event => {
  const { userId } = event
  if (!userId) throw new Error('Missing userId')
  const date = getBeijingDateString()
  const user = await db.collection('users').doc(userId).get()
  const plan = await ensureUserPlan(db, userId)

  const recordsResult = await db.collection('daily_records').where({ userId, date }).orderBy('createdAt', 'asc').get()
  const summary = {
    userId,
    date,
    ...calculateDailySummary(recordsResult.data, plan)
  }

  return {
    user: user.data,
    plan,
    date,
    records: recordsResult.data,
    summary
  }
}
