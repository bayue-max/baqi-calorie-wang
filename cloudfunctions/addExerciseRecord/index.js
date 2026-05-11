const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { getBeijingDateString } = require('./shared/date')
const { calculateExerciseBurn, buildExerciseRecordName } = require('./shared/exercise')
const { upsertDailySummary } = require('./shared/dailySummaryStore')

exports.main = async event => {
  const { userId, intensity, duration } = event
  if (!userId) throw new Error('Missing userId')
  if (!intensity) throw new Error('Missing intensity')
  if (!duration) throw new Error('Missing duration')

  const user = (await db.collection('users').doc(userId).get()).data
  const numericDuration = Number(duration)
  const burn = calculateExerciseBurn({ weight: user.weight, intensity, duration: numericDuration })
  const date = getBeijingDateString()
  const now = Date.now()
  const record = {
    userId,
    date,
    recordType: 'exercise',
    mealType: 'exercise',
    name: buildExerciseRecordName(intensity, numericDuration).replace(` ${numericDuration}min`, ''),
    exerciseIntensity: intensity,
    duration: numericDuration,
    calories: -burn,
    protein: 0,
    fat: 0,
    carb: 0,
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection('daily_records').add({ data: record })
  const summary = await upsertDailySummary(db, userId, date)
  return { record: { _id: result._id, ...record }, summary }
}
