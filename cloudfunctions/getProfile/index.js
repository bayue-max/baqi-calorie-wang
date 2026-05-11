// v4 — 理想体重 (身高-100)×男女系数（内联版本）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const DAILY_ACTIVITY_FACTOR = 1.2
const GOAL_ADJUSTMENT_MAP = { fat_loss: -350, maintain: 0, muscle_gain: 250 }
const PROTEIN_FACTOR_MAP = { fat_loss: 2.0, maintain: 1.6, muscle_gain: 1.8 }

function calculateBmr(profile) {
  const { gender, age, height, weight } = profile
  const offset = gender === 'male' ? 5 : -161
  return 10 * weight + 6.25 * height - 5 * age + offset
}

function calculateUserPlan(profile) {
  const { gender, goal, height, weight } = profile
  const bmrRaw = calculateBmr(profile)
  const proteinFactor = PROTEIN_FACTOR_MAP[goal]
  const idealWeight = gender === 'male' ? (height - 100) * 0.9 : (height - 100) * 0.85
  const adjustedWeight = idealWeight + 0.4 * Math.max(0, weight - idealWeight)
  const proteinWeight = Math.max(adjustedWeight, weight * 0.5)
  const tdeeRaw = bmrRaw * DAILY_ACTIVITY_FACTOR
  const targetCaloriesRaw = tdeeRaw + GOAL_ADJUSTMENT_MAP[goal]
  const proteinTargetRaw = Math.round(proteinWeight * proteinFactor)
  const fatTargetRaw = targetCaloriesRaw * 0.25 / 9
  const carbTargetRaw = (targetCaloriesRaw - proteinTargetRaw * 4 - fatTargetRaw * 9) / 4
  return {
    bmr: Math.round(bmrRaw), activityFactor: DAILY_ACTIVITY_FACTOR,
    tdee: Math.round(tdeeRaw), dailyActivityBurn: Math.round(tdeeRaw - bmrRaw),
    habitBurn: Math.round(tdeeRaw - bmrRaw), goal,
    calorieAdjustment: GOAL_ADJUSTMENT_MAP[goal],
    targetCalories: Math.round(targetCaloriesRaw),
    proteinTarget: Math.round(proteinTargetRaw),
    fatTarget: Math.round(fatTargetRaw),
    carbTarget: Math.round(carbTargetRaw)
  }
}

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
  return { user: user.data, plan, _version: 'v4-20260512' }
}
