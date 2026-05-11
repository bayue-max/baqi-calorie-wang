const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { getBeijingDateString } = require('./shared/date')
const { upsertDailySummary } = require('./shared/dailySummaryStore')

exports.main = async event => {
  const { userId, mealType, rawInput, items } = event
  if (!userId) throw new Error('Missing userId')
  if (!mealType) throw new Error('Missing mealType')
  if (!Array.isArray(items) || items.length === 0) throw new Error('No parsed food items')

  const date = getBeijingDateString()
  const now = Date.now()
  const recordGroupId = `${userId}_${now}`
  const tasks = items.map(item => db.collection('daily_records').add({
    data: {
      userId,
      date,
      recordType: 'food',
      recordGroupId,
      mealType,
      foodId: item.foodId,
      name: item.name,
      rawInput,
      amount: item.amount,
      unit: item.unit,
      gramEquivalent: item.gramEquivalent,
      isDefaultAmount: item.isDefaultAmount,
      calories: item.calories,
      protein: item.protein,
      fat: item.fat,
      carb: item.carb,
      createdAt: now,
      updatedAt: now
    }
  }))
  await Promise.all(tasks)
  const summary = await upsertDailySummary(db, userId, date)
  return { recordGroupId, summary }
}
