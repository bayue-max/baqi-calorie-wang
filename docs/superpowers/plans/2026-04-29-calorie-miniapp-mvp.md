# Calorie Miniapp MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the confirmed calorie tracking WeChat Mini Program MVP with login, profile, calorie plan, food/exercise records, daily summary, and trends.

**Architecture:** Use native WeChat Mini Program pages for the client and WeChat Cloud Development for persistence and backend logic. Keep all calculation, parsing, and summary logic in shared cloud modules, and let pages call cloud functions for data and mutations. Provide local mock data for page development and a cloud test user for end-to-end testing without phone authorization.

**Tech Stack:** Native WeChat Mini Program WXML/WXSS/JS, WeChat Cloud Functions on Node.js, cloud database collections, Jest for shared calculation/parser unit tests, native canvas 2D chart for the Trends page.

---

## File Structure

Create this project structure:

```text
app.js
app.json
app.wxss
project.config.json
sitemap.json
package.json
jest.config.js
miniprogram/
  app.js
  app.json
  app.wxss
  components/
    trend-chart/
      index.js
      index.json
      index.wxml
      index.wxss
  pages/
    login/
      index.js
      index.json
      index.wxml
      index.wxss
    profile-edit/
      index.js
      index.json
      index.wxml
      index.wxss
    home/
      index.js
      index.json
      index.wxml
      index.wxss
    food-add/
      index.js
      index.json
      index.wxml
      index.wxss
    exercise-add/
      index.js
      index.json
      index.wxml
      index.wxss
    profile/
      index.js
      index.json
      index.wxml
      index.wxss
    trends/
      index.js
      index.json
      index.wxml
      index.wxss
  services/
    cloud.js
    mock-data.js
    constants.js
  utils/
    format.js
cloudfunctions/
  shared/
    constants.js
    date.js
    plan.js
    foodParser.js
    exercise.js
    summary.js
    validators.js
  loginByWechatPhone/
    index.js
    package.json
  loginAsTestUser/
    index.js
    package.json
  saveProfile/
    index.js
    package.json
  getProfile/
    index.js
    package.json
  getHomeData/
    index.js
    package.json
  parseFoodInput/
    index.js
    package.json
  addFoodRecords/
    index.js
    package.json
  addExerciseRecord/
    index.js
    package.json
  updateRecord/
    index.js
    package.json
  deleteRecord/
    index.js
    package.json
  getStats/
    index.js
    package.json
cloudfunctions/
  seed/
    foods.json
tests/
  plan.test.js
  foodParser.test.js
  exercise.test.js
  summary.test.js
docs/
  superpowers/
    specs/
      2026-04-29-calorie-miniapp-mvp-design.md
    plans/
      2026-04-29-calorie-miniapp-mvp.md
```

Responsibilities:

- `cloudfunctions/shared/*`: source of truth for calculations, parsing, timezone, validation.
- `cloudfunctions/<function>/index.js`: thin cloud function handlers that validate input, call shared modules, and read/write cloud database.
- `miniprogram/services/cloud.js`: frontend wrapper for cloud calls and mock mode switching.
- `miniprogram/services/mock-data.js`: local-only mock data for page development.
- `miniprogram/pages/*`: one page per confirmed product page.
- `tests/*`: fast Node tests for logic that must not drift.

## Task 1: Project Scaffold And App Routing

**Files:**
- Create: `package.json`
- Create: `jest.config.js`
- Create: `project.config.json`
- Create: `sitemap.json`
- Create: `miniprogram/app.js`
- Create: `miniprogram/app.json`
- Create: `miniprogram/app.wxss`
- Create: starter page files under `miniprogram/pages/*`
- Create: `miniprogram/services/constants.js`

- [ ] **Step 1: Create test and project package metadata**

Create `package.json`:

```json
{
  "name": "calorie-miniapp-mvp",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test": "jest --runInBand",
    "test:logic": "jest tests --runInBand"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

Create `jest.config.js`:

```js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js']
}
```

- [ ] **Step 2: Create mini program config**

Create `miniprogram/app.json`:

```json
{
  "pages": [
    "pages/login/index",
    "pages/profile-edit/index",
    "pages/home/index",
    "pages/food-add/index",
    "pages/exercise-add/index",
    "pages/profile/index",
    "pages/trends/index"
  ],
  "window": {
    "navigationBarTitleText": "热量记录",
    "navigationBarBackgroundColor": "#ffffff",
    "navigationBarTextStyle": "black",
    "backgroundColor": "#f6f7f8"
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}
```

Create `sitemap.json`:

```json
{
  "rules": [
    {
      "action": "allow",
      "page": "*"
    }
  ]
}
```

Create `project.config.json`:

```json
{
  "miniprogramRoot": "miniprogram/",
  "cloudfunctionRoot": "cloudfunctions/",
  "setting": {
    "urlCheck": true,
    "es6": true,
    "postcss": true,
    "minified": true
  },
  "appid": "touristappid",
  "projectname": "calorie-miniapp-mvp",
  "compileType": "miniprogram"
}
```

- [ ] **Step 3: Create app bootstrap and global styles**

Create `miniprogram/app.js`:

```js
App({
  globalData: {
    envId: '',
    useMock: false,
    userId: ''
  },

  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: this.globalData.envId || undefined,
        traceUser: true
      })
    }
  }
})
```

Create `miniprogram/app.wxss`:

```css
page {
  min-height: 100%;
  background: #f6f7f8;
  color: #1f2933;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
}

.page {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
}

.section {
  margin-bottom: 24rpx;
}

.panel {
  background: #ffffff;
  border: 1rpx solid #e5e7eb;
  border-radius: 8rpx;
  padding: 24rpx;
}

.primary-button {
  background: #1677ff;
  color: #ffffff;
}

.muted {
  color: #667085;
}
```

- [ ] **Step 4: Create constants**

Create `miniprogram/services/constants.js`:

```js
const MEAL_TYPES = [
  { label: '早餐', value: 'breakfast' },
  { label: '午餐', value: 'lunch' },
  { label: '晚餐', value: 'dinner' },
  { label: '加餐', value: 'snack' }
]

const EXERCISE_INTENSITIES = [
  { label: '有氧', value: 'cardio' },
  { label: '轻度力量', value: 'light_strength' },
  { label: '中度力量', value: 'moderate_strength' },
  { label: '重度力量', value: 'heavy_strength' }
]

const GOALS = [
  { label: '减脂', value: 'fat_loss' },
  { label: '维持', value: 'maintain' },
  { label: '增肌', value: 'muscle_gain' }
]

module.exports = {
  MEAL_TYPES,
  EXERCISE_INTENSITIES,
  GOALS
}
```

- [ ] **Step 5: Create starter page JSON files**

For each page directory, create `index.json`:

```json
{
  "navigationBarTitleText": "热量记录"
}
```

Use specific titles after page implementation:

- Login: `登录`
- Profile Edit: `完善资料`
- Home: `今日记录`
- Food Add: `新增饮食`
- Exercise Add: `新增运动`
- Profile: `资料卡`
- Trends: `趋势`

- [ ] **Step 6: Run scaffold verification**

Run:

```bash
npm test
```

Expected:

```text
No tests found
```

This is acceptable for Task 1 before logic tests exist.

## Task 2: Shared Calculation Modules With Tests

**Files:**
- Create: `cloudfunctions/shared/constants.js`
- Create: `cloudfunctions/shared/plan.js`
- Create: `cloudfunctions/shared/exercise.js`
- Create: `cloudfunctions/shared/summary.js`
- Create: `tests/plan.test.js`
- Create: `tests/exercise.test.js`
- Create: `tests/summary.test.js`

- [ ] **Step 1: Write failing plan calculation tests**

Create `tests/plan.test.js`:

```js
const { calculateUserPlan } = require('../cloudfunctions/shared/plan')

describe('calculateUserPlan', () => {
  test('calculates male fat loss plan', () => {
    const plan = calculateUserPlan({
      gender: 'male',
      age: 30,
      height: 175,
      weight: 72.5,
      exerciseHabit: 'moderate_strength',
      goal: 'fat_loss'
    })

    expect(plan).toEqual({
      bmr: 1680,
      activityFactor: 1.5,
      tdee: 2520,
      habitBurn: 840,
      goal: 'fat_loss',
      calorieAdjustment: -500,
      targetCalories: 2020,
      proteinTarget: 145,
      fatTarget: 56,
      carbTarget: 224
    })
  })

  test('calculates female maintain plan', () => {
    const plan = calculateUserPlan({
      gender: 'female',
      age: 28,
      height: 165,
      weight: 58,
      exerciseHabit: 'cardio',
      goal: 'maintain'
    })

    expect(plan.bmr).toBe(1310)
    expect(plan.tdee).toBe(1769)
    expect(plan.targetCalories).toBe(1769)
    expect(plan.proteinTarget).toBe(93)
    expect(plan.fatTarget).toBe(49)
    expect(plan.carbTarget).toBe(241)
  })
})
```

- [ ] **Step 2: Run plan test and verify it fails**

Run:

```bash
npm test -- tests/plan.test.js
```

Expected: FAIL with a module-not-found error for `../cloudfunctions/shared/plan`.

- [ ] **Step 3: Implement constants and plan calculation**

Create `cloudfunctions/shared/constants.js`:

```js
const ACTIVITY_FACTOR_MAP = {
  no_exercise: 1.2,
  cardio: 1.35,
  light_strength: 1.4,
  moderate_strength: 1.5,
  heavy_strength: 1.65
}

const GOAL_ADJUSTMENT_MAP = {
  fat_loss: -500,
  maintain: 0,
  muscle_gain: 250
}

const PROTEIN_FACTOR_MAP = {
  fat_loss: 2.0,
  maintain: 1.6,
  muscle_gain: 1.8
}

const EXERCISE_BURN_COEFFICIENT_MAP = {
  cardio: 0.09,
  light_strength: 0.06,
  moderate_strength: 0.08,
  heavy_strength: 0.1
}

module.exports = {
  ACTIVITY_FACTOR_MAP,
  GOAL_ADJUSTMENT_MAP,
  PROTEIN_FACTOR_MAP,
  EXERCISE_BURN_COEFFICIENT_MAP
}
```

Create `cloudfunctions/shared/plan.js`:

```js
const {
  ACTIVITY_FACTOR_MAP,
  GOAL_ADJUSTMENT_MAP,
  PROTEIN_FACTOR_MAP
} = require('./constants')

function calculateBmr(profile) {
  const { gender, age, height, weight } = profile
  const offset = gender === 'male' ? 5 : -161
  return 10 * weight + 6.25 * height - 5 * age + offset
}

function calculateUserPlan(profile) {
  const { exerciseHabit, goal, weight } = profile
  const bmrRaw = calculateBmr(profile)
  const activityFactor = ACTIVITY_FACTOR_MAP[exerciseHabit]
  const calorieAdjustment = GOAL_ADJUSTMENT_MAP[goal]
  const proteinFactor = PROTEIN_FACTOR_MAP[goal]

  if (!activityFactor && activityFactor !== 0) {
    throw new Error(`Unsupported exerciseHabit: ${exerciseHabit}`)
  }
  if (calorieAdjustment === undefined) {
    throw new Error(`Unsupported goal: ${goal}`)
  }
  if (!proteinFactor) {
    throw new Error(`Unsupported protein goal: ${goal}`)
  }

  const tdeeRaw = bmrRaw * activityFactor
  const targetCaloriesRaw = tdeeRaw + calorieAdjustment
  const proteinTargetRaw = weight * proteinFactor
  const fatTargetRaw = targetCaloriesRaw * 0.25 / 9
  const carbTargetRaw = (targetCaloriesRaw - proteinTargetRaw * 4 - fatTargetRaw * 9) / 4

  return {
    bmr: Math.round(bmrRaw),
    activityFactor,
    tdee: Math.round(tdeeRaw),
    habitBurn: Math.round(tdeeRaw - bmrRaw),
    goal,
    calorieAdjustment,
    targetCalories: Math.round(targetCaloriesRaw),
    proteinTarget: Math.round(proteinTargetRaw),
    fatTarget: Math.round(fatTargetRaw),
    carbTarget: Math.round(carbTargetRaw)
  }
}

module.exports = {
  calculateBmr,
  calculateUserPlan
}
```

- [ ] **Step 4: Run plan tests and verify pass**

Run:

```bash
npm test -- tests/plan.test.js
```

Expected: PASS with 2 tests.

- [ ] **Step 5: Write failing exercise tests**

Create `tests/exercise.test.js`:

```js
const { calculateExerciseBurn, buildExerciseRecordName } = require('../cloudfunctions/shared/exercise')

describe('exercise calculations', () => {
  test('calculates moderate strength burn', () => {
    expect(calculateExerciseBurn({
      weight: 70,
      intensity: 'moderate_strength',
      duration: 45
    })).toBe(252)
  })

  test('builds display name with duration', () => {
    expect(buildExerciseRecordName('moderate_strength', 45)).toBe('中度力量训练 45min')
  })
})
```

- [ ] **Step 6: Implement exercise module**

Create `cloudfunctions/shared/exercise.js`:

```js
const { EXERCISE_BURN_COEFFICIENT_MAP } = require('./constants')

const EXERCISE_LABEL_MAP = {
  cardio: '有氧',
  light_strength: '轻度力量训练',
  moderate_strength: '中度力量训练',
  heavy_strength: '重度力量训练'
}

function calculateExerciseBurn({ weight, intensity, duration }) {
  const coefficient = EXERCISE_BURN_COEFFICIENT_MAP[intensity]
  if (!coefficient) {
    throw new Error(`Unsupported exercise intensity: ${intensity}`)
  }
  return Math.round(coefficient * weight * duration)
}

function buildExerciseRecordName(intensity, duration) {
  const label = EXERCISE_LABEL_MAP[intensity]
  if (!label) {
    throw new Error(`Unsupported exercise intensity: ${intensity}`)
  }
  return `${label} ${duration}min`
}

module.exports = {
  calculateExerciseBurn,
  buildExerciseRecordName
}
```

- [ ] **Step 7: Run exercise tests**

Run:

```bash
npm test -- tests/exercise.test.js
```

Expected: PASS with 2 tests.

- [ ] **Step 8: Write failing summary tests**

Create `tests/summary.test.js`:

```js
const { calculateDailySummary } = require('../cloudfunctions/shared/summary')

describe('calculateDailySummary', () => {
  const userPlan = {
    bmr: 1650,
    targetCalories: 1975,
    proteinTarget: 145,
    fatTarget: 55,
    carbTarget: 210
  }

  test('summarizes food and exercise records', () => {
    const records = [
      { recordType: 'food', calories: 240, protein: 46, fat: 5, carb: 0 },
      { recordType: 'food', calories: 174, protein: 4, fat: 0, carb: 39 },
      { recordType: 'exercise', calories: -252, protein: 0, fat: 0, carb: 0 }
    ]

    expect(calculateDailySummary(records, userPlan)).toEqual({
      bmr: 1650,
      targetCalories: 1975,
      exerciseBurn: 252,
      dynamicTargetCalories: 2227,
      foodCalories: 414,
      netCalories: 162,
      proteinTotal: 50,
      fatTotal: 5,
      carbTotal: 39,
      dynamicProteinTarget: 145,
      dynamicFatTarget: 55,
      dynamicCarbTarget: 285,
      remainingCalories: 1813,
      remainingProtein: 95,
      remainingFat: 50,
      remainingCarb: 246
    })
  })
})
```

- [ ] **Step 9: Implement summary module**

Create `cloudfunctions/shared/summary.js`:

```js
function sum(records, field) {
  return records.reduce((total, record) => total + Number(record[field] || 0), 0)
}

function calculateDailySummary(records, userPlan) {
  const foodRecords = records.filter(record => record.recordType === 'food')
  const exerciseRecords = records.filter(record => record.recordType === 'exercise')

  const foodCalories = Math.round(sum(foodRecords, 'calories'))
  const proteinTotal = Math.round(sum(foodRecords, 'protein'))
  const fatTotal = Math.round(sum(foodRecords, 'fat'))
  const carbTotal = Math.round(sum(foodRecords, 'carb'))
  const exerciseBurn = Math.abs(Math.round(sum(exerciseRecords, 'calories')))
  const dynamicTargetCalories = Math.round(userPlan.targetCalories + exerciseBurn)
  const netCalories = Math.round(foodCalories - exerciseBurn)
  const dynamicProteinTarget = Math.round(userPlan.proteinTarget)
  const dynamicFatTarget = Math.round(userPlan.fatTarget)
  const dynamicCarbTarget = Math.round(
    (dynamicTargetCalories - dynamicProteinTarget * 4 - dynamicFatTarget * 9) / 4
  )

  return {
    bmr: Math.round(userPlan.bmr),
    targetCalories: Math.round(userPlan.targetCalories),
    exerciseBurn,
    dynamicTargetCalories,
    foodCalories,
    netCalories,
    proteinTotal,
    fatTotal,
    carbTotal,
    dynamicProteinTarget,
    dynamicFatTarget,
    dynamicCarbTarget,
    remainingCalories: Math.round(dynamicTargetCalories - foodCalories),
    remainingProtein: Math.round(dynamicProteinTarget - proteinTotal),
    remainingFat: Math.round(dynamicFatTarget - fatTotal),
    remainingCarb: Math.round(dynamicCarbTarget - carbTotal)
  }
}

module.exports = {
  calculateDailySummary
}
```

- [ ] **Step 10: Run all logic tests**

Run:

```bash
npm test
```

Expected: PASS for plan, exercise, and summary tests.

## Task 3: Date, Validation, And Food Parser Modules

**Files:**
- Create: `cloudfunctions/shared/date.js`
- Create: `cloudfunctions/shared/validators.js`
- Create: `cloudfunctions/shared/foodParser.js`
- Create: `tests/foodParser.test.js`

- [ ] **Step 1: Implement Beijing date helper**

Create `cloudfunctions/shared/date.js`:

```js
function getBeijingDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(date)
}

function assertToday(dateString, now = new Date()) {
  const today = getBeijingDateString(now)
  if (dateString !== today) {
    throw new Error('MVP only supports editing Beijing-time today')
  }
}

module.exports = {
  getBeijingDateString,
  assertToday
}
```

- [ ] **Step 2: Implement validators**

Create `cloudfunctions/shared/validators.js`:

```js
function requireFields(input, fields) {
  fields.forEach(field => {
    const value = input[field]
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing required field: ${field}`)
    }
  })
}

function validateProfile(profile) {
  requireFields(profile, [
    'nickname',
    'gender',
    'age',
    'height',
    'weight',
    'exerciseHabit',
    'goal'
  ])
}

function validatePositiveNumber(value, field) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    throw new Error(`${field} must be a positive number`)
  }
}

module.exports = {
  requireFields,
  validateProfile,
  validatePositiveNumber
}
```

- [ ] **Step 3: Write failing parser tests**

Create `tests/foodParser.test.js`:

```js
const { parseFoodInput } = require('../cloudfunctions/shared/foodParser')

const foods = [
  {
    _id: 'chicken',
    name: '鸡胸肉',
    alias: ['鸡胸', '鸡肉'],
    state: 'raw',
    caloriesPer100g: 120,
    proteinPer100g: 23,
    fatPer100g: 2.5,
    carbPer100g: 0,
    unitConversions: { g: 1, 克: 1, 份: 100 },
    priority: 10,
    enabled: true
  },
  {
    _id: 'rice',
    name: '米饭',
    alias: ['白米饭'],
    state: 'cooked',
    caloriesPer100g: 116,
    proteinPer100g: 2.6,
    fatPer100g: 0.3,
    carbPer100g: 25.9,
    unitConversions: { g: 1, 克: 1, 份: 150 },
    priority: 10,
    enabled: true
  },
  {
    _id: 'egg',
    name: '鸡蛋',
    alias: ['蛋'],
    state: 'standard',
    caloriesPer100g: 140,
    proteinPer100g: 12,
    fatPer100g: 10,
    carbPer100g: 1,
    unitConversions: { g: 1, 克: 1, 个: 50 },
    priority: 10,
    enabled: true
  }
]

describe('parseFoodInput', () => {
  test('parses multiple foods with units', () => {
    const result = parseFoodInput('鸡胸肉200g，米饭150g，鸡蛋2个', foods)

    expect(result.failed).toEqual([])
    expect(result.items.map(item => ({
      name: item.name,
      amount: item.amount,
      unit: item.unit,
      gramEquivalent: item.gramEquivalent,
      calories: item.calories
    }))).toEqual([
      { name: '鸡胸肉', amount: 200, unit: 'g', gramEquivalent: 200, calories: 240 },
      { name: '米饭', amount: 150, unit: 'g', gramEquivalent: 150, calories: 174 },
      { name: '鸡蛋', amount: 2, unit: '个', gramEquivalent: 100, calories: 140 }
    ])
  })

  test('uses default 100g when amount is missing', () => {
    const result = parseFoodInput('鸡胸', foods)
    expect(result.items[0].name).toBe('鸡胸肉')
    expect(result.items[0].isDefaultAmount).toBe(true)
    expect(result.items[0].gramEquivalent).toBe(100)
  })

  test('ignores meal words and reports unknown foods', () => {
    const result = parseFoodInput('午餐鸡胸肉200g，未知食物100g', foods)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].name).toBe('鸡胸肉')
    expect(result.failed).toEqual(['未知食物'])
  })
})
```

- [ ] **Step 4: Implement parser**

Create `cloudfunctions/shared/foodParser.js`:

```js
const MEAL_WORDS = ['早餐', '午餐', '晚餐', '加餐']
const UNIT_PATTERN = '(kg|千克|g|克|ml|个|根|份)'

function normalizeText(text) {
  return MEAL_WORDS.reduce((value, mealWord) => value.replaceAll(mealWord, ''), text)
    .replace(/，/g, ',')
    .replace(/、/g, ',')
    .replace(/；/g, ',')
    .replace(/;/g, ',')
    .trim()
}

function splitSegments(text) {
  const normalized = normalizeText(text)
  if (normalized.includes(',')) {
    return normalized.split(',').map(item => item.trim()).filter(Boolean)
  }
  return normalized
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function parseSegment(segment) {
  const regex = new RegExp(`^(.+?)(\\d+(?:\\.\\d+)?)?\\s*${UNIT_PATTERN}?$`)
  const match = segment.match(regex)
  if (!match) {
    return { nameText: segment, amount: 100, unit: 'g', isDefaultAmount: true }
  }

  const nameText = match[1].trim()
  const amount = match[2] ? Number(match[2]) : 100
  const unit = match[3] || 'g'
  return {
    nameText,
    amount,
    unit,
    isDefaultAmount: !match[2]
  }
}

function scoreFood(food, nameText) {
  if (!food.enabled) return 0
  if (food.name === nameText) return 100 + Number(food.priority || 0)
  if ((food.alias || []).includes(nameText)) return 90 + Number(food.priority || 0)
  if (food.name.includes(nameText) || nameText.includes(food.name)) return 70 + Number(food.priority || 0)
  if ((food.alias || []).some(alias => alias.includes(nameText) || nameText.includes(alias))) {
    return 60 + Number(food.priority || 0)
  }
  return 0
}

function findFood(foods, nameText) {
  const scored = foods
    .map(food => ({ food, score: scoreFood(food, nameText) }))
    .filter(item => item.score >= 60)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return null
  if (scored.length === 1) return scored[0].food
  if (scored[0].score - scored[1].score >= 10) return scored[0].food
  return null
}

function gramEquivalentFor(parsed, food) {
  if (parsed.unit === 'kg' || parsed.unit === '千克') return parsed.amount * 1000
  const conversions = food.unitConversions || {}
  const factor = conversions[parsed.unit]
  if (!factor) return null
  return parsed.amount * factor
}

function calculateNutrition(food, grams) {
  const ratio = grams / 100
  return {
    calories: Math.round(Number(food.caloriesPer100g) * ratio),
    protein: Math.round(Number(food.proteinPer100g) * ratio),
    fat: Math.round(Number(food.fatPer100g) * ratio),
    carb: Math.round(Number(food.carbPer100g) * ratio)
  }
}

function parseFoodInput(rawInput, foods) {
  const segments = splitSegments(rawInput)
  const items = []
  const failed = []

  segments.forEach(segment => {
    const parsed = parseSegment(segment)
    const food = findFood(foods, parsed.nameText)
    if (!food) {
      failed.push(parsed.nameText)
      return
    }

    const grams = gramEquivalentFor(parsed, food)
    if (!grams) {
      failed.push(parsed.nameText)
      return
    }

    items.push({
      foodId: food._id,
      name: food.name,
      rawSegment: segment,
      amount: parsed.amount,
      unit: parsed.unit,
      gramEquivalent: Math.round(grams),
      isDefaultAmount: parsed.isDefaultAmount,
      ...calculateNutrition(food, grams)
    })
  })

  return { items, failed }
}

module.exports = {
  parseFoodInput
}
```

- [ ] **Step 5: Run parser tests**

Run:

```bash
npm test -- tests/foodParser.test.js
```

Expected: PASS with 3 tests.

- [ ] **Step 6: Run all shared tests**

Run:

```bash
npm test
```

Expected: PASS for all test files.

## Task 4: Seed Food Data

**Files:**
- Create: `cloudfunctions/seed/foods.json`

- [ ] **Step 1: Create first seed batch with required representative entries**

Create `cloudfunctions/seed/foods.json` with at least 100 entries before release testing. Start with these exact entries, then add the remaining entries from Step 2 before the release gate.

```json
[
  {
    "_id": "food_chicken_breast_raw",
    "name": "鸡胸肉",
    "alias": ["鸡胸", "鸡胸肉", "鸡肉"],
    "state": "raw",
    "defaultUnit": "g",
    "caloriesPer100g": 120,
    "proteinPer100g": 23,
    "fatPer100g": 2.5,
    "carbPer100g": 0,
    "unitConversions": { "g": 1, "克": 1, "份": 100 },
    "priority": 10,
    "enabled": true
  },
  {
    "_id": "food_rice_cooked",
    "name": "米饭",
    "alias": ["白米饭", "米饭"],
    "state": "cooked",
    "defaultUnit": "g",
    "caloriesPer100g": 116,
    "proteinPer100g": 2.6,
    "fatPer100g": 0.3,
    "carbPer100g": 25.9,
    "unitConversions": { "g": 1, "克": 1, "份": 150 },
    "priority": 10,
    "enabled": true
  },
  {
    "_id": "food_egg_standard",
    "name": "鸡蛋",
    "alias": ["蛋", "鸡蛋"],
    "state": "standard",
    "defaultUnit": "个",
    "caloriesPer100g": 140,
    "proteinPer100g": 12,
    "fatPer100g": 10,
    "carbPer100g": 1,
    "unitConversions": { "g": 1, "克": 1, "个": 50 },
    "priority": 10,
    "enabled": true
  }
]
```

- [ ] **Step 2: Complete seed data to the MVP target**

Add entries for the PRD categories:

```text
主食: 大米, 面条, 燕麦, 红薯, 土豆, 馒头
蛋白质: 牛肉, 鱼, 虾, 豆腐, 牛奶, 蛋白粉
脂肪来源: 坚果, 橄榄油, 牛油果
蔬菜: 西兰花, 菠菜, 生菜, 胡萝卜
水果: 香蕉, 苹果, 橙子, 蓝莓
常见轻食: 沙拉, 鸡胸肉饭, 牛肉饭
```

For every entry, include:

```json
{
  "_id": "stable_food_id",
  "name": "食物名",
  "alias": ["常见别名"],
  "state": "raw",
  "defaultUnit": "g",
  "caloriesPer100g": 100,
  "proteinPer100g": 10,
  "fatPer100g": 1,
  "carbPer100g": 10,
  "unitConversions": { "g": 1, "克": 1, "份": 100 },
  "priority": 10,
  "enabled": true
}
```

- [ ] **Step 3: Validate seed JSON**

Run:

```bash
node -e "const foods=require('./cloudfunctions/seed/foods.json'); const ids=new Set(); foods.forEach(f=>{ if(ids.has(f._id)) throw new Error('duplicate '+f._id); ids.add(f._id); ['name','alias','caloriesPer100g','proteinPer100g','fatPer100g','carbPer100g','unitConversions'].forEach(k=>{ if(f[k]===undefined) throw new Error(f._id+' missing '+k) }); }); console.log('foods', foods.length)"
```

Expected: prints `foods <count>` with no thrown errors. Before release, `<count>` should be at least 100.

## Task 5: Cloud Function Handlers

**Files:**
- Create/modify all `cloudfunctions/<name>/index.js`
- Create/modify all `cloudfunctions/<name>/package.json`

- [ ] **Step 1: Create shared handler package metadata**

For each cloud function directory, create `package.json`:

```json
{
  "name": "calorie-cloud-function",
  "version": "0.1.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "^3.0.1"
  }
}
```

- [ ] **Step 2: Implement `loginAsTestUser`**

Create `cloudfunctions/loginAsTestUser/index.js`:

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const USERS = 'users'

exports.main = async () => {
  const now = Date.now()
  const testPhone = 'test-user'
  const existing = await db.collection(USERS).where({
    accountType: 'test',
    phone: testPhone
  }).limit(1).get()

  if (existing.data.length > 0) {
    return { user: existing.data[0], isNew: false }
  }

  const user = {
    accountType: 'test',
    phone: testPhone,
    openid: '',
    unionid: '',
    avatarUrl: '',
    defaultAvatarType: 'male',
    nickname: '测试用户',
    profileCompleted: false,
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection(USERS).add({ data: user })
  return { user: { ...user, _id: result._id }, isNew: true }
}
```

- [ ] **Step 3: Implement `loginByWechatPhone`**

Create `cloudfunctions/loginByWechatPhone/index.js`:

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async event => {
  const wxContext = cloud.getWXContext()
  const phoneCode = event.code
  if (!phoneCode) {
    throw new Error('Missing phone authorization code')
  }

  const phoneResult = await cloud.openapi.phonenumber.getPhoneNumber({ code: phoneCode })
  const phone = phoneResult.phoneInfo.phoneNumber
  const now = Date.now()

  const existing = await db.collection('users').where({
    accountType: 'official',
    phone
  }).limit(1).get()

  if (existing.data.length > 0) {
    const user = existing.data[0]
    await db.collection('users').doc(user._id).update({
      data: {
        openid: wxContext.OPENID,
        unionid: wxContext.UNIONID || user.unionid || '',
        updatedAt: now
      }
    })
    return {
      user: { ...user, openid: wxContext.OPENID, unionid: wxContext.UNIONID || user.unionid || '' },
      isNew: false
    }
  }

  const user = {
    accountType: 'official',
    phone,
    openid: wxContext.OPENID,
    unionid: wxContext.UNIONID || '',
    avatarUrl: '',
    defaultAvatarType: 'male',
    nickname: '',
    profileCompleted: false,
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection('users').add({ data: user })
  return { user: { ...user, _id: result._id }, isNew: true }
}
```

- [ ] **Step 4: Implement `saveProfile`**

Create `cloudfunctions/saveProfile/index.js`:

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { calculateUserPlan } = require('../shared/plan')
const { validateProfile } = require('../shared/validators')

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
  if (existingPlan.data.length > 0) {
    await db.collection('user_plan').doc(existingPlan.data[0]._id).update({ data: plan })
    return { user: { _id: userId, ...userPatch }, plan: { ...existingPlan.data[0], ...plan } }
  }

  const addResult = await db.collection('user_plan').add({
    data: { ...plan, createdAt: now }
  })
  return { user: { _id: userId, ...userPatch }, plan: { _id: addResult._id, ...plan, createdAt: now } }
}
```

- [ ] **Step 5: Implement read and stats functions**

Create `cloudfunctions/getProfile/index.js`:

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async event => {
  const { userId } = event
  if (!userId) throw new Error('Missing userId')
  const user = await db.collection('users').doc(userId).get()
  const plan = await db.collection('user_plan').where({ userId }).limit(1).get()
  return { user: user.data, plan: plan.data[0] || null }
}
```

Create `cloudfunctions/getHomeData/index.js`:

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { getBeijingDateString } = require('../shared/date')
const { calculateDailySummary } = require('../shared/summary')

exports.main = async event => {
  const { userId } = event
  if (!userId) throw new Error('Missing userId')
  const date = getBeijingDateString()
  const user = await db.collection('users').doc(userId).get()
  const planResult = await db.collection('user_plan').where({ userId }).limit(1).get()
  const plan = planResult.data[0]
  if (!plan) throw new Error('Missing user plan')

  const recordsResult = await db.collection('daily_records').where({ userId, date }).orderBy('createdAt', 'asc').get()
  const summaryResult = await db.collection('daily_summary').where({ userId, date }).limit(1).get()
  const summary = summaryResult.data[0] || {
    userId,
    date,
    ...calculateDailySummary([], plan)
  }

  return {
    user: user.data,
    plan,
    date,
    records: recordsResult.data,
    summary
  }
}
```

Create `cloudfunctions/getStats/index.js`:

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function dateRange(mode, now = new Date()) {
  const beijingNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
  const start = new Date(beijingNow)
  if (mode === 'month') {
    start.setDate(1)
  } else {
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
  }
  const end = new Date(beijingNow)
  if (mode === 'month') {
    end.setMonth(start.getMonth() + 1, 0)
  } else {
    end.setTime(start.getTime())
    end.setDate(start.getDate() + 6)
  }
  const format = date => date.toISOString().slice(0, 10)
  return { start: format(start), end: format(end) }
}

exports.main = async event => {
  const { userId, mode = 'week' } = event
  if (!userId) throw new Error('Missing userId')
  const range = dateRange(mode)
  const planResult = await db.collection('user_plan').where({ userId }).limit(1).get()
  const plan = planResult.data[0]
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
    points: summaries.data.map(item => ({
      date: item.date,
      foodCalories: item.foodCalories
    }))
  }
}
```

- [ ] **Step 6: Implement parse and write functions**

Create `cloudfunctions/parseFoodInput/index.js`:

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { parseFoodInput } = require('../shared/foodParser')

exports.main = async event => {
  const { rawInput } = event
  if (!rawInput) throw new Error('Missing rawInput')
  const foodsResult = await db.collection('foods').where({ enabled: true }).limit(1000).get()
  if (foodsResult.data.length === 0) {
    throw new Error('Food library is not initialized')
  }
  return parseFoodInput(rawInput, foodsResult.data)
}
```

Create `cloudfunctions/addFoodRecords/index.js`:

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { getBeijingDateString } = require('../shared/date')
const { calculateDailySummary } = require('../shared/summary')

async function recalculate(userId, date) {
  const plan = (await db.collection('user_plan').where({ userId }).limit(1).get()).data[0]
  const records = (await db.collection('daily_records').where({ userId, date }).get()).data
  const summary = { userId, date, ...calculateDailySummary(records, plan), updatedAt: Date.now() }
  const existing = await db.collection('daily_summary').where({ userId, date }).limit(1).get()
  if (existing.data.length) {
    await db.collection('daily_summary').doc(existing.data[0]._id).update({ data: summary })
    return { ...existing.data[0], ...summary }
  }
  const added = await db.collection('daily_summary').add({ data: summary })
  return { _id: added._id, ...summary }
}

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
  const summary = await recalculate(userId, date)
  return { recordGroupId, summary }
}
```

Create `cloudfunctions/addExerciseRecord/index.js`:

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { getBeijingDateString } = require('../shared/date')
const { calculateDailySummary } = require('../shared/summary')
const { calculateExerciseBurn, buildExerciseRecordName } = require('../shared/exercise')

async function recalculate(userId, date) {
  const plan = (await db.collection('user_plan').where({ userId }).limit(1).get()).data[0]
  const records = (await db.collection('daily_records').where({ userId, date }).get()).data
  const summary = { userId, date, ...calculateDailySummary(records, plan), updatedAt: Date.now() }
  const existing = await db.collection('daily_summary').where({ userId, date }).limit(1).get()
  if (existing.data.length) {
    await db.collection('daily_summary').doc(existing.data[0]._id).update({ data: summary })
    return { ...existing.data[0], ...summary }
  }
  const added = await db.collection('daily_summary').add({ data: summary })
  return { _id: added._id, ...summary }
}

exports.main = async event => {
  const { userId, intensity, duration } = event
  if (!userId) throw new Error('Missing userId')
  if (!intensity) throw new Error('Missing intensity')
  if (!duration) throw new Error('Missing duration')

  const user = (await db.collection('users').doc(userId).get()).data
  const burn = calculateExerciseBurn({ weight: user.weight, intensity, duration: Number(duration) })
  const date = getBeijingDateString()
  const now = Date.now()
  const record = {
    userId,
    date,
    recordType: 'exercise',
    mealType: 'exercise',
    name: buildExerciseRecordName(intensity, Number(duration)),
    exerciseIntensity: intensity,
    duration: Number(duration),
    calories: -burn,
    protein: 0,
    fat: 0,
    carb: 0,
    createdAt: now,
    updatedAt: now
  }
  const added = await db.collection('daily_records').add({ data: record })
  const summary = await recalculate(userId, date)
  return { record: { _id: added._id, ...record }, summary }
}
```

- [ ] **Step 7: Implement update and delete**

Create `cloudfunctions/updateRecord/index.js` with validation that the record date equals Beijing-time today, then update allowed fields:

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { getBeijingDateString } = require('../shared/date')
const { calculateDailySummary } = require('../shared/summary')

async function recalculate(userId, date) {
  const plan = (await db.collection('user_plan').where({ userId }).limit(1).get()).data[0]
  const records = (await db.collection('daily_records').where({ userId, date }).get()).data
  const summary = { userId, date, ...calculateDailySummary(records, plan), updatedAt: Date.now() }
  const existing = await db.collection('daily_summary').where({ userId, date }).limit(1).get()
  if (existing.data.length) await db.collection('daily_summary').doc(existing.data[0]._id).update({ data: summary })
  return summary
}

exports.main = async event => {
  const { recordId, patch } = event
  if (!recordId) throw new Error('Missing recordId')
  const record = (await db.collection('daily_records').doc(recordId).get()).data
  const today = getBeijingDateString()
  if (record.date !== today) throw new Error('MVP only supports editing today')

  const allowed = {}
  ;['mealType', 'amount', 'unit', 'gramEquivalent', 'calories', 'protein', 'fat', 'carb', 'exerciseIntensity', 'duration', 'name'].forEach(key => {
    if (patch[key] !== undefined) allowed[key] = patch[key]
  })
  allowed.updatedAt = Date.now()
  await db.collection('daily_records').doc(recordId).update({ data: allowed })
  const summary = await recalculate(record.userId, today)
  return { record: { ...record, ...allowed }, summary }
}
```

Create `cloudfunctions/deleteRecord/index.js`:

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { getBeijingDateString } = require('../shared/date')
const { calculateDailySummary } = require('../shared/summary')

async function recalculate(userId, date) {
  const plan = (await db.collection('user_plan').where({ userId }).limit(1).get()).data[0]
  const records = (await db.collection('daily_records').where({ userId, date }).get()).data
  const summary = { userId, date, ...calculateDailySummary(records, plan), updatedAt: Date.now() }
  const existing = await db.collection('daily_summary').where({ userId, date }).limit(1).get()
  if (existing.data.length) await db.collection('daily_summary').doc(existing.data[0]._id).update({ data: summary })
  return summary
}

exports.main = async event => {
  const { recordId } = event
  if (!recordId) throw new Error('Missing recordId')
  const record = (await db.collection('daily_records').doc(recordId).get()).data
  const today = getBeijingDateString()
  if (record.date !== today) throw new Error('MVP only supports deleting today')
  await db.collection('daily_records').doc(recordId).remove()
  const summary = await recalculate(record.userId, today)
  return { deletedRecordId: recordId, summary }
}
```

- [ ] **Step 8: Run logic tests after handlers are added**

Run:

```bash
npm test
```

Expected: all shared module tests still pass.

## Task 6: Frontend Cloud Service And Mock Data

**Files:**
- Create: `miniprogram/services/cloud.js`
- Create: `miniprogram/services/mock-data.js`
- Create: `miniprogram/utils/format.js`

- [ ] **Step 1: Create cloud wrapper**

Create `miniprogram/services/cloud.js`:

```js
const mock = require('./mock-data')

function appState() {
  return getApp().globalData
}

async function callFunction(name, data = {}) {
  if (appState().useMock && mock[name]) {
    return mock[name](data)
  }
  const result = await wx.cloud.callFunction({ name, data })
  return result.result
}

module.exports = {
  callFunction,
  loginByWechatPhone: data => callFunction('loginByWechatPhone', data),
  loginAsTestUser: data => callFunction('loginAsTestUser', data),
  saveProfile: data => callFunction('saveProfile', data),
  getProfile: data => callFunction('getProfile', data),
  getHomeData: data => callFunction('getHomeData', data),
  parseFoodInput: data => callFunction('parseFoodInput', data),
  addFoodRecords: data => callFunction('addFoodRecords', data),
  addExerciseRecord: data => callFunction('addExerciseRecord', data),
  updateRecord: data => callFunction('updateRecord', data),
  deleteRecord: data => callFunction('deleteRecord', data),
  getStats: data => callFunction('getStats', data)
}
```

- [ ] **Step 2: Create mock data service**

Create `miniprogram/services/mock-data.js`:

```js
const mockUser = {
  _id: 'mock_user',
  accountType: 'mock',
  nickname: '八月',
  gender: 'male',
  age: 30,
  height: 175,
  weight: 72.5,
  exerciseHabit: 'moderate_strength',
  goal: 'fat_loss',
  profileCompleted: true
}

const mockPlan = {
  bmr: 1680,
  activityFactor: 1.5,
  tdee: 2520,
  habitBurn: 840,
  calorieAdjustment: -500,
  targetCalories: 2020,
  proteinTarget: 145,
  fatTarget: 56,
  carbTarget: 224
}

let records = []
let summary = {
  bmr: 1680,
  targetCalories: 2020,
  exerciseBurn: 0,
  dynamicTargetCalories: 2020,
  foodCalories: 0,
  netCalories: 0,
  proteinTotal: 0,
  fatTotal: 0,
  carbTotal: 0,
  dynamicProteinTarget: 145,
  dynamicFatTarget: 56,
  dynamicCarbTarget: 224,
  remainingCalories: 2020,
  remainingProtein: 145,
  remainingFat: 56,
  remainingCarb: 224
}

async function loginAsTestUser() {
  return { user: mockUser, isNew: false }
}

async function getHomeData() {
  return {
    user: mockUser,
    plan: mockPlan,
    date: '2026-04-29',
    records,
    summary
  }
}

async function getProfile() {
  return { user: mockUser, plan: mockPlan }
}

async function getStats() {
  return {
    mode: 'week',
    range: { start: '2026-04-27', end: '2026-05-03' },
    bmr: mockPlan.bmr,
    targetCalories: mockPlan.targetCalories,
    points: [
      { date: '2026-04-27', foodCalories: 1800 },
      { date: '2026-04-28', foodCalories: 2100 },
      { date: '2026-04-29', foodCalories: summary.foodCalories }
    ]
  }
}

module.exports = {
  loginAsTestUser,
  getHomeData,
  getProfile,
  getStats
}
```

- [ ] **Step 3: Create formatting utils**

Create `miniprogram/utils/format.js`:

```js
function kcal(value) {
  return `${Math.round(Number(value || 0))} kcal`
}

function gram(value) {
  return `${Math.round(Number(value || 0))}g`
}

function signedKcal(value) {
  const rounded = Math.round(Number(value || 0))
  return rounded > 0 ? `+${rounded} kcal` : `${rounded} kcal`
}

module.exports = {
  kcal,
  gram,
  signedKcal
}
```

## Task 7: Login And Profile Pages

**Files:**
- Create/modify: `miniprogram/pages/login/index.*`
- Create/modify: `miniprogram/pages/profile-edit/index.*`
- Create/modify: `miniprogram/pages/profile/index.*`

- [ ] **Step 1: Implement Login page behavior**

Create `miniprogram/pages/login/index.js`:

```js
const api = require('../../services/cloud')

Page({
  data: {
    loading: false
  },

  async loginWithPhone(event) {
    const code = event.detail.code
    if (!code) {
      wx.showToast({ title: '请授权手机号', icon: 'none' })
      return
    }
    await this.login(() => api.loginByWechatPhone({ code }))
  },

  async loginAsTestUser() {
    await this.login(() => api.loginAsTestUser())
  },

  async enterMockMode() {
    getApp().globalData.useMock = true
    await this.login(() => api.loginAsTestUser())
  },

  async login(loginAction) {
    this.setData({ loading: true })
    try {
      const { user } = await loginAction()
      getApp().globalData.userId = user._id
      wx.redirectTo({
        url: user.profileCompleted ? '/pages/home/index' : '/pages/profile-edit/index'
      })
    } catch (error) {
      wx.showToast({ title: error.message || '登录失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
```

Create `miniprogram/pages/login/index.wxml`:

```xml
<view class="page login-page">
  <view class="brand">
    <text class="title">热量记录</text>
    <text class="subtitle">记录摄入、运动和今日进度</text>
  </view>

  <button class="primary-button" open-type="getPhoneNumber" bindgetphonenumber="loginWithPhone" loading="{{loading}}">
    微信手机号登录
  </button>
  <button bindtap="loginAsTestUser" loading="{{loading}}">测试用户登录</button>
  <button bindtap="enterMockMode" loading="{{loading}}">本地 Mock 体验</button>
</view>
```

Create `miniprogram/pages/login/index.wxss`:

```css
.login-page {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  justify-content: center;
}

.brand {
  margin-bottom: 40rpx;
}

.title {
  display: block;
  font-size: 48rpx;
  font-weight: 700;
}

.subtitle {
  display: block;
  margin-top: 12rpx;
  color: #667085;
}
```

- [ ] **Step 2: Implement Profile Edit form**

Create page data with fields, picker options, validation, and `saveProfile` call. Use this exact save payload:

```js
const payload = {
  nickname: this.data.nickname,
  avatarUrl: this.data.avatarUrl,
  gender: this.data.gender,
  age: Number(this.data.age),
  height: Number(this.data.height),
  weight: Number(this.data.weight),
  exerciseHabit: this.data.exerciseHabit,
  goal: this.data.goal
}
```

On success:

```js
wx.redirectTo({ url: '/pages/home/index' })
```

Validation message:

```js
wx.showToast({ title: '请完整填写资料', icon: 'none' })
```

- [ ] **Step 3: Implement Profile page**

Profile page loads `getProfile({ userId })` and displays:

```text
昵称, 性别, 年龄, 身高, 体重, 运动习惯, 目标
BMR, 运动习惯消耗, 目标缺口/盈余, 今日建议摄入
蛋白质目标, 脂肪目标, 碳水目标
```

The edit button navigates to:

```js
wx.navigateTo({ url: '/pages/profile-edit/index' })
```

## Task 8: Home, Food Add, And Exercise Add Pages

**Files:**
- Create/modify: `miniprogram/pages/home/index.*`
- Create/modify: `miniprogram/pages/food-add/index.*`
- Create/modify: `miniprogram/pages/exercise-add/index.*`

- [ ] **Step 1: Implement Home data loading**

Home `onShow` calls:

```js
const api = require('../../services/cloud')

Page({
  data: {
    loading: true,
    summary: null,
    records: []
  },

  onShow() {
    this.load()
  },

  async load() {
    try {
      const userId = getApp().globalData.userId
      const data = await api.getHomeData({ userId })
      this.setData({
        loading: false,
        summary: data.summary,
        records: data.records
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  goFoodAdd() {
    wx.navigateTo({ url: '/pages/food-add/index' })
  },

  goExerciseAdd() {
    wx.navigateTo({ url: '/pages/exercise-add/index' })
  },

  goTrends() {
    wx.navigateTo({ url: '/pages/trends/index' })
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/index' })
  }
})
```

Home WXML must contain only these major sections:

```xml
<view class="page">
  <view class="panel section">
    <text>今日进度</text>
    <text>{{summary.foodCalories}} / {{summary.dynamicTargetCalories}} kcal</text>
    <text>还可摄入 {{summary.remainingCalories}} kcal</text>
  </view>

  <view class="panel section">
    <text>蛋白质 {{summary.proteinTotal}} / {{summary.dynamicProteinTarget}}g</text>
    <text>脂肪 {{summary.fatTotal}} / {{summary.dynamicFatTarget}}g</text>
    <text>碳水 {{summary.carbTotal}} / {{summary.dynamicCarbTarget}}g</text>
  </view>

  <scroll-view scroll-x class="record-table">
    <!-- table header, records, system summary row, remaining row -->
  </scroll-view>

  <button bindtap="goFoodAdd">新增饮食</button>
  <button bindtap="goExerciseAdd">新增运动</button>
</view>
```

- [ ] **Step 2: Implement Food Add parse-preview-confirm flow**

Food Add data state:

```js
{
  mealType: 'breakfast',
  rawInput: '',
  parsedItems: [],
  failedItems: [],
  parsing: false,
  saving: false
}
```

Flow:

```js
async parse() {
  const result = await api.parseFoodInput({ rawInput: this.data.rawInput })
  this.setData({ parsedItems: result.items, failedItems: result.failed })
}

async confirmAdd() {
  if (this.data.parsedItems.length === 0) {
    wx.showToast({ title: '未识别到可计算的食物', icon: 'none' })
    return
  }
  await api.addFoodRecords({
    userId: getApp().globalData.userId,
    mealType: this.data.mealType,
    rawInput: this.data.rawInput,
    items: this.data.parsedItems
  })
  wx.navigateBack()
}
```

Preview must show each parsed item:

```text
名称 数量 单位 克重 热量 蛋白质 脂肪 碳水
```

Default amount item must show:

```text
默认100g
```

- [ ] **Step 3: Implement Exercise Add**

Exercise Add state:

```js
{
  exercised: true,
  intensity: 'moderate_strength',
  duration: ''
}
```

Submit behavior:

```js
if (!this.data.exercised) {
  wx.navigateBack()
  return
}
await api.addExerciseRecord({
  userId: getApp().globalData.userId,
  intensity: this.data.intensity,
  duration: Number(this.data.duration)
})
wx.navigateBack()
```

If duration is empty or non-positive, show:

```js
wx.showToast({ title: '请输入运动时长', icon: 'none' })
```

## Task 9: Trends Page

**Files:**
- Create/modify: `miniprogram/pages/trends/index.*`
- Create/modify: `miniprogram/components/trend-chart/index.*`

- [ ] **Step 1: Implement data loading**

Trends page state:

```js
{
  mode: 'week',
  stats: null,
  loading: true
}
```

Load:

```js
const stats = await api.getStats({
  userId: getApp().globalData.userId,
  mode: this.data.mode
})
this.setData({ stats, loading: false })
```

Switch:

```js
switchMode(event) {
  this.setData({ mode: event.currentTarget.dataset.mode }, () => this.load())
}
```

- [ ] **Step 2: Implement native canvas chart component contract**

The chart component receives:

```js
properties: {
  points: Array,
  bmr: Number,
  targetCalories: Number
}
```

It renders on native canvas:

- Food intake line from `points[].foodCalories`.
- BMR horizontal line.
- Target calorie horizontal line.
- X labels from `points[].date`.

Create `miniprogram/components/trend-chart/index.json`:

```json
{
  "component": true
}
```

Create `miniprogram/components/trend-chart/index.wxml`:

```xml
<view class="chart-wrap">
  <canvas type="2d" id="trendCanvas" class="chart-canvas"></canvas>
</view>
```

Create `miniprogram/components/trend-chart/index.wxss`:

```css
.chart-wrap {
  width: 100%;
  height: 520rpx;
  background: #ffffff;
  border: 1rpx solid #e5e7eb;
  border-radius: 8rpx;
}

.chart-canvas {
  width: 100%;
  height: 520rpx;
}
```

Create `miniprogram/components/trend-chart/index.js`:

```js
Component({
  properties: {
    points: { type: Array, value: [] },
    bmr: { type: Number, value: 0 },
    targetCalories: { type: Number, value: 0 }
  },

  observers: {
    'points,bmr,targetCalories': function () {
      this.draw()
    }
  },

  lifetimes: {
    ready() {
      this.draw()
    }
  },

  methods: {
    draw() {
      const query = this.createSelectorQuery()
      query.select('#trendCanvas').fields({ node: true, size: true }).exec(res => {
        const canvasInfo = res[0]
        if (!canvasInfo || !canvasInfo.node) return
        const canvas = canvasInfo.node
        const ctx = canvas.getContext('2d')
        const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
        const dpr = win.pixelRatio
        canvas.width = canvasInfo.width * dpr
        canvas.height = canvasInfo.height * dpr
        ctx.scale(dpr, dpr)
        this.drawChart(ctx, canvasInfo.width, canvasInfo.height)
      })
    },

    drawChart(ctx, width, height) {
      const padding = { left: 44, right: 18, top: 28, bottom: 40 }
      const points = this.data.points || []
      const values = points.map(point => Number(point.foodCalories || 0))
      const maxValue = Math.max(this.data.bmr, this.data.targetCalories, ...values, 1)
      const innerWidth = width - padding.left - padding.right
      const innerHeight = height - padding.top - padding.bottom

      ctx.clearRect(0, 0, width, height)
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padding.left, padding.top)
      ctx.lineTo(padding.left, height - padding.bottom)
      ctx.lineTo(width - padding.right, height - padding.bottom)
      ctx.stroke()

      const yFor = value => padding.top + innerHeight - (Number(value || 0) / maxValue) * innerHeight
      const xFor = index => padding.left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * innerWidth)

      this.drawBaseline(ctx, 'BMR', this.data.bmr, yFor(this.data.bmr), width, padding)
      this.drawBaseline(ctx, '目标', this.data.targetCalories, yFor(this.data.targetCalories), width, padding)

      ctx.strokeStyle = '#1677ff'
      ctx.lineWidth = 2
      ctx.beginPath()
      points.forEach((point, index) => {
        const x = xFor(index)
        const y = yFor(point.foodCalories)
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      ctx.fillStyle = '#475467'
      ctx.font = '10px sans-serif'
      points.forEach((point, index) => {
        if (points.length > 12 && index % 3 !== 0) return
        ctx.fillText(point.date.slice(5), xFor(index) - 12, height - 16)
      })
    },

    drawBaseline(ctx, label, value, y, width, padding) {
      ctx.strokeStyle = label === 'BMR' ? '#12b76a' : '#f79009'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#475467'
      ctx.font = '10px sans-serif'
      ctx.fillText(`${label} ${Math.round(value)}`, padding.left + 4, y - 4)
    }
  }
})
```

- [ ] **Step 3: Verify Trends page behavior**

Manual check in WeChat Developer Tools:

```text
Open Trends -> default mode is 本周 -> data loads.
Tap 本月 -> mode changes to month -> getStats is called again.
Baseline values match Profile plan.
```

## Task 10: Manual End-To-End Verification

**Files:**
- Verify all pages and cloud functions.

- [ ] **Step 1: Run logic tests**

Run:

```bash
npm test
```

Expected: all test suites pass.

- [ ] **Step 2: Verify formal blocked paths**

In WeChat Developer Tools:

```text
Refuse phone authorization -> stay on Login, show retry prompt.
Enter test user -> if profile incomplete, redirect Profile Edit.
Save complete profile -> Home opens.
```

- [ ] **Step 3: Verify food scenarios**

Use Food Add:

```text
鸡胸肉200g -> one parsed item.
鸡胸肉200g，米饭150g，鸡蛋2个 -> three parsed items.
鸡胸肉 -> default 100g marker.
午餐鸡胸肉200g -> selected meal type wins.
鸡胸肉200g，未知食物100g -> one parsed item, one failed item.
未知食物100g -> no parsed item, cannot confirm.
```

- [ ] **Step 4: Verify exercise scenarios**

Use Exercise Add with a 70kg profile:

```text
No exercise -> no record.
Moderate strength 45min -> record shows 中度力量训练 45min and -252 kcal.
Home dynamic target increases by 252 kcal.
Protein and fat targets stay unchanged.
Carb target increases.
```

- [ ] **Step 5: Verify Home scope**

Home must show:

```text
今日进度区
营养素进度
今日记录表
新增饮食按钮
新增运动按钮
```

Home must not show:

```text
趋势图
BMR/运动习惯消耗/目标缺口/完整热量计划
```

- [ ] **Step 6: Verify Profile and Trends**

Profile must show:

```text
用户资料
BMR
运动习惯消耗
目标缺口/盈余
今日建议摄入
蛋白质/脂肪/碳水目标
```

Trends must show:

```text
本周/本月切换
食物摄入热量
BMR 基准线
建议摄入基准线
```

- [ ] **Step 7: Final risk review**

Before declaring the MVP implementation complete, confirm:

```text
Food seed count is at least 100 for release testing.
Mock mode does not write cloud database.
Cloud test user writes cloud database.
Only Beijing-time today can be edited or deleted.
All calculations come from shared cloud modules.
```
