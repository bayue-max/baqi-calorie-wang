const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { ensureUserPlan } = require('./shared/dailySummaryStore')
const { buildStatsPoints } = require('./shared/stats')

function formatDate(date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateRange(mode, now = new Date()) {
  const beijingNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
  const start = new Date(beijingNow)
  if (mode === 'month') {
    start.setDate(start.getDate() - 29)
  } else {
    start.setDate(start.getDate() - 6)
  }

  const end = new Date(beijingNow)

  return { start: formatDate(start), end: formatDate(end) }
}

exports.main = async event => {
  const { userId, mode = 'week' } = event
  if (!userId) throw new Error('Missing userId')
  const range = dateRange(mode)
  const plan = await ensureUserPlan(db, userId)
  const _ = db.command
  const summaries = await db.collection('daily_summary').where({
    userId,
    date: _.gte(range.start).and(_.lte(range.end))
  }).orderBy('date', 'asc').get()

  return {
    mode,
    range,
    bmr: plan ? plan.bmr : 0,
    targetCalories: plan ? plan.targetCalories : 0,
    totalBurnCalories: plan ? plan.tdee : 0,
    points: buildStatsPoints(summaries.data, plan)
  }
}
