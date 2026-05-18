# Calorie Miniapp MVP Design

Date: 2026-04-29 | Updated: 2026-05-19
Status: Design approved; spec updated to reflect implemented code
Target platform: WeChat Mini Program
Implementation direction: Native WeChat Mini Program + WeChat Cloud Development

## 1. Goal

Build an MVP WeChat mini program for calorie intake tracking. The product helps fitness and diet-control users complete this daily loop:

1. Log in with WeChat.
2. Complete basic profile.
3. Generate daily calorie and macronutrient targets.
4. Record food by meal using one text input.
5. Parse multiple foods via three-layer engine (rule → cooking → AI decomposition).
6. Record exercise and add burned calories to today's dynamic target.
7. View today's progress, nutrition progress, and records.
8. View weekly/monthly calorie intake trends on a separate trend page.

The MVP does not include daily weight logs, weight trend charts, photo recognition, recipes, community features, training plans, or external nutrition database integrations.

## 2. Confirmed Product Decisions

| Topic | Decision |
|---|---|
| Delivery model | Native WeChat Mini Program + WeChat Cloud Development |
| Formal login | WeChat phone-number authorization + "立即体验" skip mode for review compliance |
| Development/experience mode | Support both local mock data and a cloud test user |
| Food parsing | Three-layer engine: Rule Engine → Cooking Method Detection → DeepSeek AI Decomposition. Dual database: 520 basic foods + 386 composite dishes |
| AI caching | DB-persisted `dish_cache` with 30-day TTL; low-confidence results not cached; count-unit scaling (个/只/份) |
| Record correction | Food and exercise records support edit and delete |
| Food recording UI | Single modal on Home page (not a separate page) |
| Exercise recording UI | Single modal on Home page with tab-based type selection (有氧 8 types / 力量 3 types) |
| Food library | 520 basic foods + 386 composite dishes (906 total) loaded as local JSON in cloud function |
| Chart | Separate trend page; canvas 2D with touch tooltip, dual baseline, week/month modes |
| Frontend stack | Native WXML/WXSS/JS |
| Date scope | MVP only allows recording Beijing-time today |
| Timezone | Asia/Shanghai |
| Home priority | Prioritize consumed/target progress; background prefetch profile + trends data |

## 3. Page Structure

The MVP contains five pages + two modals:

| Page | Path | Responsibility |
|---|---|---|
| Login | `/pages/login/index` | Dual-mode: WeChat phone login + "立即体验" skip |
| Profile Edit | `/pages/profile-edit/index` | First-time profile completion and later profile editing |
| Home | `/pages/home/index` | Today's progress, nutrition bars, records, food/exercise modals |
| Profile | `/pages/profile/index` | User profile, calorie plan, formula explanation popup |
| Trends | `/pages/trends/index` | Weekly/monthly calorie chart with canvas touch interaction |

Food recording and exercise recording are **modals inside Home**, not separate pages. This reduces navigation steps and keeps the user on the main screen.

### Additional pages

| Page | Path | Responsibility |
|---|---|---|
| Agreement | `/pages/agreement/index` | Privacy policy (WeChat review requirement) |
| Privacy | `/pages/privacy/index` | Privacy settings |

## 4. Home Design

Home contains:

1. **Coach area** — Shiba inu mascot, motivational text bubble, calorie progress ring.
2. **Nutrition progress bars** — Protein / Carb / Fat with target vs consumed, percentage fill.
3. **Today's record list** — Grouped by meal (breakfast/lunch/dinner/snack) + exercise group.
4. **Quick actions** — "记一餐" and "记运动" buttons open modals.

### Food recording modal

- Meal type selector (早餐/午餐/晚餐/加餐).
- Single text input for food description.
- "解析预览" button calls `parseFoodInput`.
- Preview shows parsed items with name, amount, calories, macros.
- AI-decomposed items show total calories only (breakdown hidden).
- "确认添加" saves and refreshes.

### Exercise recording modal

- Tab bar: 有氧 | 力量.
- 有氧 grid (2 columns): 快走, 椭圆机, 骑行, 慢跑, 游泳, 跑步机爬坡, HIIT, 跳绳.
- 力量 grid (2 columns): 轻度力量, 中度力量, 重度力量.
- Duration input (minutes).
- Cancel / Save buttons.

### Background prefetch

After Home data loads, the page fires background API calls to pre-warm caches for Profile and Trends pages. Switching tabs feels instant.

## 5. Profile And Plan

### Profile fields

| Field | Required | Notes |
|---|---:|---|
| Nickname | Yes | Displayed in profile |
| Gender | Yes | Male/female |
| Age | Yes | Used for BMR |
| Height | Yes | cm |
| Weight | Yes | kg |
| Goal | Yes | 减脂 / 维持 / 增肌 |

Note: Exercise habit was removed from the profile. TDEE uses a fixed activity factor of 1.2 (sedentary) for all users. Individual exercise is tracked daily instead.

### Formula popup

Profile page "热量计划" title has a clickable "计算公式" link that opens a centered modal explaining all calculation formulas.

## 6. Trends Page

- Default view: current Beijing-time week.
- Toggle: 7-day / 30-day.
- Canvas 2D chart with touch tooltip (tap near a point to see date, total burn, target, actual intake).
- Lines: actual food intake (solid orange), suggested intake (dashed orange), daily total burn (dashed brown).
- 400ms draw delay on first render to avoid overlap during page transition.
- Cache-first rendering: shows cached data instantly, refreshes in background.

## 7. Data Model

### 7.1 `users`

```json
{
  "_id": "user_id",
  "accountType": "official",
  "phone": "13800000000",
  "openid": "wechat_openid",
  "nickname": "八月",
  "gender": "male",
  "age": 30,
  "height": 175,
  "weight": 72.5,
  "goal": "fat_loss",
  "profileCompleted": true,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

### 7.2 `user_plan`

```json
{
  "_id": "plan_id",
  "userId": "user_id",
  "bmr": 1520,
  "activityFactor": 1.2,
  "tdee": 1824,
  "dailyActivityBurn": 304,
  "habitBurn": 304,
  "goal": "fat_loss",
  "calorieAdjustment": -350,
  "targetCalories": 1474,
  "proteinTarget": 140,
  "fatTarget": 41,
  "carbTarget": 136,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

### 7.3 `foods`

Seed JSON loaded locally in `parseFoodInput` cloud function (520 items). Not queried from database.

```json
{
  "_id": "food_chicken_breast_raw",
  "name": "鸡胸肉",
  "alias": ["鸡胸", "鸡胸肉", "鸡肉", "白肉", "鸡脯肉"],
  "state": "raw",
  "defaultUnit": "g",
  "defaultWeight": 200,
  "caloriesPer100g": 120,
  "proteinPer100g": 23,
  "fatPer100g": 2.5,
  "carbPer100g": 0,
  "unitConversions": { "g": 1, "克": 1, "份": 100 },
  "priority": 10,
  "enabled": true
}
```

### 7.4 `composite_dishes`

386 pre-computed composite dishes with nutrition per serving.

### 7.5 `daily_records`

Food and exercise share one collection. Same structure as original design.

### 7.6 `daily_summary`

Same structure as original design, with one change: `dynamicFatTarget` is now recalculated as `dynamicTargetCalories × 25% ÷ 9`, keeping fat proportional when exercise increases the calorie budget.

### 7.7 `dish_cache` (new)

AI decomposition cache. Persisted in cloud database, 30-day TTL.

```json
{
  "_id": "去皮鸡腿",
  "dishName": "去皮鸡腿",
  "confidence": "medium",
  "totalCalories": 180,
  "totalProtein": 27,
  "totalFat": 8,
  "totalCarb": 0,
  "ingredients": [
    { "name": "鸡腿肉", "weight": 150, "unit": "g" }
  ],
  "servingSize": { "amount": 1, "unit": "个", "totalGrams": 150 },
  "expiresAt": 1781258750846,
  "createdAt": 1778666750846,
  "updatedAt": 1778666750846
}
```

Cache read flow: memory (30min TTL) → DB (30-day TTL) → AI call.
Low-confidence results (`confidence: "low"`) are not written to DB.

## 8. Cloud Functions

| Function | Responsibility |
|---|---|
| `loginByWechatPhone` | Formal WeChat phone login/register |
| `loginAsTestUser` | Development/experience cloud test-user login |
| `saveProfile` | Save profile, calculate plan with adjusted-weight protein formula, upsert daily summary |
| `getProfile` | Return profile; recalculate plan on each call (inline formula) |
| `getHomeData` | Return today's user, plan, records, and calculated summary |
| `parseFoodInput` | Parse food input through three-layer engine; AI cache read/write; count-unit scaling; load foods/composite_dishes from local JSON |
| `addFoodRecords` | Persist food records, recalculate daily summary, upsert plan if needed |
| `addExerciseRecord` | Calculate exercise burn (11 types), persist, recalculate summary |
| `updateRecord` | Update today's record, recalculate summary |
| `deleteRecord` | Delete today's record, recalculate summary |
| `getStats` | Return weekly/monthly chart data with date range and summary points |

Key change: `saveProfile` and `getProfile` both inline the plan calculation formula rather than relying on `shared/plan.js`, to ensure deployment reliability.

## 9. Food Parsing Architecture

### Three-layer engine

1. **Layer 1 — Rule Engine**: Match against 520 basic foods by name/alias. Supports multi-food comma/space separation, unit extraction (g/克/ml/毫升/个/只/份/碗/盘/杯/勺…), cooking method prefix handling.
2. **Layer 2 — Cooking Method Detection**: 15 cooking methods with oil estimates and water gain factors.
3. **Layer 3 — AI Decomposition (DeepSeek)**: For unrecognized dishes (e.g., "红烧肉", "无糖拿铁"). AI returns ingredients + total nutrition. Results cached in `dish_cache`.

### AI fallback nutrition

When AI returns ingredient names not in the local food database, per-100g nutrition is estimated by keyword matching:

| Keywords | kcal/100g | Example |
|---|---|---|
| 奶/乳 | 60 | 全脂牛奶 |
| 油/脂 | 800 | 亚麻籽油 |
| 米/面/粉/饼/饭/粥 | 200 | 米粉 |
| 肉/排/腿/翅/蹄/肘/肝 | 150 | 猪肉 |
| 酱/料/汤/汁/卤/膏 | 80 | 麻酱 |
| 菜/蔬/菇/瓜/叶/花/椒/葱/姜/蒜 | 30 | 冬瓜 |
| 茶/咖啡/饮料/酒/啤 | 5 | 浓缩咖啡 |
| (none) | 100 | 兜底 |

### Cache deduplication

All number+unit combos are stripped from the cache key. "去皮鸡腿1个", "1个去皮鸡腿", "去皮鸡腿2个" all normalize to key `去皮鸡腿`.

### Count-unit scaling

When cache is hit with a different count (e.g., "去皮鸡腿2个" vs cached "1个"), `servingSize` is used to compute per-unit grams and scale ingredients proportionally.

## 10. Exercise Recording

### Types and coefficients

Exercise burn = coefficient × weight(kg) × duration(min).

**有氧:**

| Type | Key | Coefficient | 62kg/30min |
|---|---|---|---|
| 快走 | brisk_walk | 0.06 | ~112 |
| 椭圆机 | elliptical | 0.08 | ~149 |
| 骑行 | cycling | 0.11 | ~205 |
| 慢跑 | jogging | 0.13 | ~242 |
| 游泳 | swimming | 0.13 | ~242 |
| 跑步机爬坡 | treadmill_climb | 0.15 | ~279 |
| HIIT | hiit | 0.16 | ~298 |
| 跳绳 | jump_rope | 0.19 | ~353 |

**力量:**

| Type | Key | Coefficient | 62kg/30min |
|---|---|---|---|
| 轻度力量 | light_strength | 0.04 | ~74 |
| 中度力量 | moderate_strength | 0.05 | ~93 |
| 重度力量 | heavy_strength | 0.07 | ~130 |

## 11. Calculation Rules

### BMR (Mifflin-St Jeor)

```
male   = 10 × weight + 6.25 × height - 5 × age + 5
female = 10 × weight + 6.25 × height - 5 × age - 161
```

### TDEE

```
TDEE = BMR × 1.2 (fixed sedentary factor)
```

### Goal adjustments

| Goal | Adjustment |
|---|---:|
| Fat loss | -350 kcal |
| Maintain | 0 kcal |
| Muscle gain | +250 kcal |

### Protein (adjusted body weight formula)

Uses ideal body weight to prevent excessive protein for large-framed users and insufficient protein for underweight users.

```
idealWeight = male   ? (height - 100) × 0.9
              female ? (height - 100) × 0.85

adjustedWeight = idealWeight + 0.4 × max(0, weight - idealWeight)
proteinWeight  = max(adjustedWeight, weight × 0.5)

proteinTarget = proteinWeight × factor
  fat_loss:    2.0
  maintain:    1.6
  muscle_gain: 1.8
```

### Fat

```
fatTarget = targetCalories × 25% ÷ 9
```

### Carbohydrate

```
carbTarget = (targetCalories - proteinTarget × 4 - fatTarget × 9) ÷ 4
```

### After exercise (dynamic targets)

```
dynamicTargetCalories = targetCalories + exerciseBurn
dynamicProteinTarget = proteinTarget (unchanged)
dynamicFatTarget      = dynamicTargetCalories × 25% ÷ 9 (proportional)
dynamicCarbTarget     = (dynamicTargetCalories - dynamicProteinTarget × 4 - dynamicFatTarget × 9) ÷ 4
```

Note: `dynamicFatTarget` was changed from using a static `plan.fatTarget` to a dynamic calculation. This keeps macronutrient ratios balanced when exercise increases the calorie budget.

## 12. Date Rules

- All user-facing dates use Asia/Shanghai.
- `date` is stored as `YYYY-MM-DD`.
- MVP only allows recording Beijing-time today.
- Current week is Monday to Sunday.
- Current month is the natural Beijing-time month.

## 13. Error Handling

| Scenario | Behavior |
|---|---|
| User refuses phone authorization | Show "立即体验" skip option |
| Formal user has incomplete profile | Redirect to Profile Edit |
| User has no plan | Recalculate from user profile |
| Food library is empty | (not applicable — loaded from local JSON) |
| Food parse partial failure | Show failed items and allow adding successful items |
| Food parse full failure | Do not add records |
| AI decomposition timeout (3s) | Return null, item not added |
| Cloud function failure | Preserve current input and show retry prompt |
| Edit/delete non-today records | Reject in MVP |
| Profile edit changes today's plan | Recalculate today's summary targets |

## 14. Acceptance Criteria

### Login And Profile

- New official user can authorize phone, create account, and enter Profile Edit.
- Returning official user enters Home when profile is complete.
- "立即体验" skip mode works without phone authorization.
- Required profile fields block save when empty.
- Saving complete profile generates `user_plan` with adjusted-weight protein formula.
- Editing weight or goal recalculates plan.

### Food Recording

- `鸡胸肉200g` creates one food record.
- `鸡胸肉200g，米饭150g，鸡蛋2个` creates three records.
- `鸡胸肉` uses default weight from food library.
- AI decomposes unrecognized dishes (e.g., `红烧肉200g`).
- Second user input of same dish hits `dish_cache` — no AI call.
- Different count (2个 vs 1个) correctly scales via `servingSize`.

### Exercise Recording

- 有氧 tab shows 8 types, 力量 tab shows 3 types.
- Moderate strength 30min for 62kg user creates ~93 kcal exercise record.
- Exercise increases today's dynamic calorie target.
- Protein target unchanged; fat target scales proportionally with dynamic target.

### Home

- Home shows coach mascot, progress, nutrition bars, records.
- Food and exercise modals open/close smoothly.
- Background prefetch warms Profile and Trends page caches.

### Trends

- Trends defaults to current week.
- Chart shows food intake line, BMR baseline, target baseline.
- Touch shows date tooltip with details.
- Cache-first: second visit shows chart instantly.
