const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { getBeijingDateString } = require('./shared/date')
const { upsertDailySummary } = require('./shared/dailySummaryStore')

exports.main = async event => {
  const { recordId, patch } = event
  if (!recordId) throw new Error('Missing recordId')
  const record = (await db.collection('daily_records').doc(recordId).get()).data
  const today = getBeijingDateString()
  if (record.date !== today) throw new Error('MVP only supports editing today')

  const allowed = {}
  ;[
    'mealType',
    'amount',
    'unit',
    'gramEquivalent',
    'calories',
    'protein',
    'fat',
    'carb',
    'exerciseIntensity',
    'duration',
    'name'
  ].forEach(key => {
    if (patch[key] !== undefined) allowed[key] = patch[key]
  })
  allowed.updatedAt = Date.now()
  await db.collection('daily_records').doc(recordId).update({ data: allowed })
  const summary = await upsertDailySummary(db, record.userId, today)
  return { record: { ...record, ...allowed }, summary }
}
