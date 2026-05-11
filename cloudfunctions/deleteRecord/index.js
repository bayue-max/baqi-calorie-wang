const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { getBeijingDateString } = require('./shared/date')
const { upsertDailySummary } = require('./shared/dailySummaryStore')

exports.main = async event => {
  const { recordId } = event
  if (!recordId) throw new Error('Missing recordId')
  const record = (await db.collection('daily_records').doc(recordId).get()).data
  const today = getBeijingDateString()
  if (record.date !== today) throw new Error('MVP only supports deleting today')
  await db.collection('daily_records').doc(recordId).remove()
  const summary = await upsertDailySummary(db, record.userId, today)
  return { deletedRecordId: recordId, summary }
}
