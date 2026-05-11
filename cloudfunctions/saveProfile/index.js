// v4 — 理想体重 (身高-100)×男女系数
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { validateProfile } = require('./shared/validators')
const { getBeijingDateString } = require('./shared/date')
const { upsertDailySummary } = require('./shared/dailySummaryStore')

const DAILY_ACTIVITY_FACTOR = 1.2
const GOAL_ADJUSTMENT_MAP = { fat_loss: -350, maintain: 0, muscle_gain: 250 }
const PROTEIN_FACTOR_MAP = { fat_loss: 2.0, maintain: 1.6, muscle_gain: 1.8 }

function calculateBmr(profile) {
  var gender = profile.gender, age = profile.age, height = profile.height, weight = profile.weight
  var offset = gender === 'male' ? 5 : -161
  return 10 * weight + 6.25 * height - 5 * age + offset
}

function calculateUserPlan(profile) {
  var gender = profile.gender, goal = profile.goal, height = profile.height, weight = profile.weight
  var bmrRaw = calculateBmr(profile)
  var proteinFactor = PROTEIN_FACTOR_MAP[goal]
  var idealWeight = gender === 'male' ? (height - 100) * 0.9 : (height - 100) * 0.85
  var adjustedWeight = idealWeight + 0.4 * Math.max(0, weight - idealWeight)
  var proteinWeight = Math.max(adjustedWeight, weight * 0.5)
  var tdeeRaw = bmrRaw * DAILY_ACTIVITY_FACTOR
  var targetCaloriesRaw = tdeeRaw + GOAL_ADJUSTMENT_MAP[goal]
  var proteinTargetRaw = Math.round(proteinWeight * proteinFactor)
  var fatTargetRaw = targetCaloriesRaw * 0.25 / 9
  var carbTargetRaw = (targetCaloriesRaw - proteinTargetRaw * 4 - fatTargetRaw * 9) / 4
  return {
    bmr: Math.round(bmrRaw), activityFactor: DAILY_ACTIVITY_FACTOR,
    tdee: Math.round(tdeeRaw), dailyActivityBurn: Math.round(tdeeRaw - bmrRaw),
    habitBurn: Math.round(tdeeRaw - bmrRaw), goal: goal,
    calorieAdjustment: GOAL_ADJUSTMENT_MAP[goal],
    targetCalories: Math.round(targetCaloriesRaw),
    proteinTarget: Math.round(proteinTargetRaw),
    fatTarget: Math.round(fatTargetRaw),
    carbTarget: Math.round(carbTargetRaw)
  }
}

exports.main = async event => {
  var userId = event.userId, profile = event.profile
  if (!userId) throw new Error('Missing userId')
  validateProfile(profile)
  var now = Date.now()
  var userPatch = Object.assign({}, profile, { profileCompleted: true, updatedAt: now })
  await db.collection('users').doc(userId).update({ data: userPatch })

  var plan = Object.assign({ userId: userId }, calculateUserPlan(profile), { updatedAt: now })
  var existingPlan = await db.collection('user_plan').where({ userId: userId }).limit(1).get()
  if (existingPlan.data.length > 0) {
    await db.collection('user_plan').doc(existingPlan.data[0]._id).update({ data: plan })
  } else {
    await db.collection('user_plan').add({ data: Object.assign({ createdAt: now }, plan) })
  }
  var summary = await upsertDailySummary(db, userId, getBeijingDateString())
  return { user: Object.assign({ _id: userId }, userPatch), plan: plan, summary: summary }
}
