# Calorie Miniapp MVP Design

Date: 2026-04-29
Status: Design approved in conversation; written spec pending user review
Target platform: WeChat Mini Program
Implementation direction: Native WeChat Mini Program + WeChat Cloud Development

## 1. Goal

Build an MVP WeChat mini program for calorie intake tracking. The product helps fitness and diet-control users complete this daily loop:

1. Log in with WeChat.
2. Complete basic profile.
3. Generate daily calorie and macronutrient targets.
4. Record food by meal using one text input.
5. Parse multiple foods automatically against a seed food library.
6. Record exercise and add burned calories to today's dynamic target.
7. View today's progress, nutrition progress, and records.
8. View weekly/monthly calorie intake trends on a separate trend page.

The MVP does not include daily weight logs, weight trend charts, photo recognition, recipes, community features, training plans, or external nutrition database integrations.

## 2. Confirmed Product Decisions

| Topic | Decision |
|---|---|
| Delivery model | Native WeChat Mini Program + WeChat Cloud Development |
| Formal login | WeChat phone-number authorization is the official login path |
| Development/experience mode | Support both local mock data and a cloud test user |
| Food parsing | Rule parsing + simple correction, no AI parsing in MVP |
| Record correction | Food and exercise records support edit and delete |
| Today's record UI | Use a horizontal table as described in the PRD |
| Food library | Seed 100-200 common foods in the cloud database |
| Chart | Separate trend page; weekly/monthly food intake line with BMR and target lines |
| Frontend stack | Native WXML/WXSS/JS |
| Date scope | MVP only allows recording Beijing-time today |
| Timezone | Asia/Shanghai |
| Home priority | Prioritize consumed/target progress |

## 3. Page Structure

The MVP contains seven pages after scope clarification:

| Page | Path Example | Responsibility |
|---|---|---|
| Login | `/pages/login/index` | WeChat phone login, cloud test-user login, local mock entry for development |
| Profile Edit | `/pages/profile-edit/index` | First-time profile completion and later profile editing |
| Home | `/pages/home/index` | Today's progress, nutrition progress, today's record table |
| Food Add | `/pages/food-add/index` | Meal selection, one text input, parse preview, confirm add |
| Exercise Add | `/pages/exercise-add/index` | Exercise intensity and duration recording |
| Profile | `/pages/profile/index` | User profile, current calorie plan, edit entry |
| Trends | `/pages/trends/index` | Weekly/monthly calorie intake chart |

Home is intentionally lean. It does not show the trend chart or full calorie plan. Trend analysis belongs to the Trends page. BMR, habit burn, calorie adjustment, target calories, and macronutrient targets belong to the Profile page.

## 4. Home Design

Home contains only:

1. Today's progress.
2. Nutrition progress.
3. Today's record table.

Today's progress shows:

- Food calories consumed / dynamic target calories.
- Remaining calories.
- Today's exercise burn when greater than 0.

Nutrition progress shows:

- Protein consumed / dynamic protein target.
- Fat consumed / dynamic fat target.
- Carbohydrate consumed / dynamic carbohydrate target.

Today's record table:

- Uses a horizontal table on mobile.
- Columns: meal type, name, amount/description, calories, protein, fat, carbohydrate, actions.
- Food and exercise records can be edited and deleted.
- The system rows "daily summary" and "remaining" are fixed at the bottom and cannot be edited or deleted.
- Exercise records show negative calories and `-` for macronutrients.
- The first column should remain readable while horizontally scrolling if feasible in mini program layout.

## 5. Profile And Plan

Profile fields:

| Field | Required | Notes |
|---|---:|---|
| Avatar | No | Use default male/female avatar if empty |
| Nickname | Yes | Displayed in profile |
| Gender | Yes | Male/female |
| Age | Yes | Used for BMR |
| Height | Yes | cm |
| Weight | Yes | kg; only used for calculation in MVP |
| Exercise habit | Yes | No exercise, cardio, light strength, moderate strength, heavy strength |
| Goal | Yes | Muscle gain, fat loss, maintain |

When profile is saved:

1. Validate required fields.
2. Save user profile.
3. Recalculate `user_plan` if any calculation-affecting field changed.
4. Refresh today's summary targets if needed.
5. Return to Home or Profile depending on entry point.

Fields that trigger plan recalculation:

- Gender.
- Age.
- Height.
- Weight.
- Exercise habit.
- Goal.

Nickname and avatar do not trigger plan recalculation.

## 6. Trends Page

The Trends page shows the calorie intake chart that was originally in Home.

Chart rules:

- Default view: current Beijing-time natural week, Monday to Sunday.
- Toggle: current week / current month.
- Line: daily food intake calories only.
- Baseline 1: BMR.
- Baseline 2: target calories from current `user_plan`.
- Exercise burn is not subtracted from the trend line.
- Historical plan changes are not backfilled in MVP; the chart uses the current plan baselines.

## 7. Data Model

### 7.1 `users`

Add an account type so formal users and development users can share the same app flows.

```json
{
  "_id": "user_id",
  "accountType": "official",
  "phone": "13800000000",
  "openid": "wechat_openid",
  "unionid": "wechat_unionid",
  "avatarUrl": "",
  "defaultAvatarType": "male",
  "nickname": "八月",
  "gender": "male",
  "age": 30,
  "height": 175,
  "weight": 72.5,
  "exerciseHabit": "moderate_strength",
  "goal": "fat_loss",
  "profileCompleted": true,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

`accountType` values:

- `official`: WeChat phone-number user.
- `test`: Cloud test user.
- `mock`: Local-only development data. It is not stored in the cloud database.

### 7.2 `user_plan`

Stores the current effective plan for a user.

```json
{
  "_id": "plan_id",
  "userId": "user_id",
  "bmr": 1650,
  "activityFactor": 1.5,
  "tdee": 2475,
  "habitBurn": 825,
  "goal": "fat_loss",
  "calorieAdjustment": -500,
  "targetCalories": 1975,
  "proteinTarget": 145,
  "fatTarget": 55,
  "carbTarget": 210,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

### 7.3 `foods`

Seed 100-200 common fitness and diet-control foods.

```json
{
  "_id": "food_id",
  "name": "鸡胸肉",
  "alias": ["鸡胸", "鸡胸肉", "鸡肉"],
  "state": "raw",
  "defaultUnit": "g",
  "caloriesPer100g": 120,
  "proteinPer100g": 23,
  "fatPer100g": 2.5,
  "carbPer100g": 0,
  "unitConversions": {
    "g": 1,
    "份": 100
  },
  "priority": 10,
  "enabled": true,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

Food matching rules:

- Prefer enabled foods.
- Match exact name and alias first.
- Use simple fuzzy matching only when one high-confidence result exists.
- If several foods are plausible, do not guess unless priority and state make one result unambiguous.
- For same food with multiple states, prefer raw/unprocessed entries unless the food is inherently a prepared item such as rice, milk, banana, egg, or oats.

### 7.4 `daily_records`

Food and exercise share one collection.

Food example:

```json
{
  "_id": "record_id",
  "userId": "user_id",
  "date": "2026-04-29",
  "recordType": "food",
  "recordGroupId": "group_id",
  "mealType": "lunch",
  "foodId": "food_id",
  "name": "鸡胸肉",
  "rawInput": "鸡胸肉200g，米饭150g，鸡蛋2个",
  "amount": 200,
  "unit": "g",
  "gramEquivalent": 200,
  "isDefaultAmount": false,
  "calories": 240,
  "protein": 46,
  "fat": 5,
  "carb": 0,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

Exercise example:

```json
{
  "_id": "record_id",
  "userId": "user_id",
  "date": "2026-04-29",
  "recordType": "exercise",
  "mealType": "exercise",
  "name": "中度力量训练 45min",
  "exerciseIntensity": "moderate_strength",
  "duration": 45,
  "calories": -252,
  "protein": 0,
  "fat": 0,
  "carb": 0,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

MVP only allows creating, editing, and deleting records for Beijing-time today.

### 7.5 `daily_summary`

Stores the recalculated daily snapshot for Home and Trends.

```json
{
  "_id": "summary_id",
  "userId": "user_id",
  "date": "2026-04-29",
  "bmr": 1650,
  "targetCalories": 1975,
  "exerciseBurn": 252,
  "dynamicTargetCalories": 2227,
  "foodCalories": 980,
  "netCalories": 728,
  "proteinTotal": 82,
  "fatTotal": 34,
  "carbTotal": 95,
  "dynamicProteinTarget": 145,
  "dynamicFatTarget": 55,
  "dynamicCarbTarget": 285,
  "remainingCalories": 1247,
  "remainingProtein": 63,
  "remainingFat": 21,
  "remainingCarb": 190,
  "updatedAt": 1710000000000
}
```

## 8. Cloud Functions

| Function | Responsibility |
|---|---|
| `loginByWechatPhone` | Formal WeChat phone login/register, returns profile completion state |
| `loginAsTestUser` | Development/experience cloud test-user login |
| `saveProfile` | Save profile and recalculate user plan when needed |
| `getProfile` | Return profile and current plan for Profile page |
| `getHomeData` | Return today's progress, nutrition progress, records, and summary |
| `parseFoodInput` | Parse and preview food input without writing records |
| `addFoodRecords` | Persist confirmed parsed food records and recalculate today's summary |
| `addExerciseRecord` | Add exercise record and recalculate today's summary |
| `updateRecord` | Update today's food/exercise record and recalculate summary |
| `deleteRecord` | Delete today's record and recalculate summary |
| `recalculateDailySummary` | Shared recalculation function used by write operations |
| `getStats` | Return weekly/monthly chart data for Trends page |

Core calculation logic lives in cloud-function shared modules. The frontend should not duplicate BMR, target, food nutrition, exercise burn, or daily summary calculations.

## 9. Food Recording Flow

Food Add page flow:

1. User selects meal type: breakfast, lunch, dinner, or snack.
2. User enters one or more foods in a single text field.
3. Page calls `parseFoodInput`.
4. Page shows a parse preview with recognized foods, default quantity markers, and unrecognized items.
5. User confirms.
6. Page calls `addFoodRecords`.
7. Cloud function persists records and recalculates `daily_summary`.
8. User returns to Home.

Supported units:

- `g`, `克`.
- `kg`, `千克`.
- `ml`.
- `个`.
- `根`.
- `份`.

Default quantity rule:

- If no quantity is provided, use 100g.
- Mark the record with `isDefaultAmount = true`.

Failure rules:

- Partial failure: save recognized foods after user confirmation and show unrecognized items as not counted.
- Full failure: do not save and ask user to change food names.

## 10. Exercise Recording Flow

Exercise Add page fields:

- Whether exercised today.
- Exercise intensity: cardio, light strength, moderate strength, heavy strength.
- Duration in minutes.

If the user selects "no exercise", no record is created.

Exercise burn formula:

```text
exercise burn = per-minute coefficient * weight kg * duration minutes
```

Coefficients:

| Intensity | Coefficient |
|---|---:|
| Cardio | 0.09 |
| Light strength | 0.06 |
| Moderate strength | 0.08 |
| Heavy strength | 0.10 |

Exercise is stored as a negative-calorie record. It increases today's dynamic calorie target.

## 11. Calculation Rules

BMR:

```text
male = 10 * weight + 6.25 * height - 5 * age + 5
female = 10 * weight + 6.25 * height - 5 * age - 161
```

Activity factors:

| Habit | Factor |
|---|---:|
| No exercise | 1.20 |
| Cardio | 1.35 |
| Light strength | 1.40 |
| Moderate strength | 1.50 |
| Heavy strength | 1.65 |

Goal adjustments:

| Goal | Adjustment |
|---|---:|
| Fat loss | -500 kcal |
| Maintain | 0 kcal |
| Muscle gain | +250 kcal |

Protein:

| Goal | Protein |
|---|---:|
| Fat loss | 2.0g * weight kg |
| Maintain | 1.6g * weight kg |
| Muscle gain | 1.8g * weight kg |

Fat:

```text
fatTarget = targetCalories * 25% / 9
```

Carbohydrate:

```text
carbTarget = (targetCalories - proteinTarget * 4 - fatTarget * 9) / 4
```

After exercise:

```text
dynamicTargetCalories = targetCalories + exerciseBurn
dynamicProteinTarget = proteinTarget
dynamicFatTarget = fatTarget
dynamicCarbTarget = (dynamicTargetCalories - proteinTarget * 4 - fatTarget * 9) / 4
```

Daily summary:

```text
foodCalories = sum(food record calories)
exerciseBurn = abs(sum(exercise record calories))
netCalories = foodCalories - exerciseBurn
remainingCalories = dynamicTargetCalories - foodCalories
```

Macronutrient totals count only food records.

## 12. Date Rules

- All user-facing dates use Asia/Shanghai.
- `date` is stored as `YYYY-MM-DD`.
- MVP only allows recording Beijing-time today.
- Current week is Monday to Sunday.
- Current month is the natural Beijing-time month.
- When a user opens Home after midnight, the app reads the new date. If no summary exists, the backend returns an empty-record default summary based on the current plan.

## 13. Error Handling

| Scenario | Behavior |
|---|---|
| User refuses phone authorization | Stay on Login and show retry prompt |
| Formal user has incomplete profile | Redirect to Profile Edit |
| User has no plan | Ask user to save profile again |
| Food library is empty | Food Add cannot submit and shows library-not-ready message |
| Food parse partial failure | Show failed items and allow adding successful items |
| Food parse full failure | Do not add records |
| Cloud function failure | Preserve current input and show retry prompt |
| Edit/delete non-today records | Reject in MVP |
| Profile edit changes today's plan | Recalculate today's summary targets; records stay unchanged |

## 14. Acceptance Criteria

### Login And Profile

- New official user can authorize phone, create account, and enter Profile Edit.
- Returning official user enters Home when profile is complete.
- Test user login can enter the same flows without phone authorization.
- Required profile fields block save when empty.
- Saving complete profile generates `user_plan`.
- Editing weight or goal recalculates plan.
- Editing nickname or avatar does not recalculate plan.

### Food Recording

- `鸡胸肉200g` creates one food record after preview and confirmation.
- `鸡胸肉200g，米饭150g，鸡蛋2个` creates three records.
- `鸡胸肉` uses default 100g and marks the default quantity.
- Meal type comes from the selected meal, even if text contains a meal word.
- Partial failure saves recognized foods and reports unrecognized foods.
- Full failure saves nothing.

### Exercise Recording

- Selecting no exercise creates no record.
- Moderate strength 45min for a 70kg user creates a `-252 kcal` exercise record.
- Exercise increases today's dynamic target.
- Exercise does not change protein or fat targets; extra calories go to carbohydrate target.

### Home

- Home shows only today's progress, nutrition progress, and today's record table.
- Food/exercise add, edit, and delete refresh Home.
- System summary rows are visible and cannot be edited or deleted.
- Table remains usable on small mobile screens through horizontal scrolling.

### Trends

- Trends defaults to current week.
- User can switch to current month.
- Chart line shows food intake calories.
- BMR and target calorie baselines are shown.

## 15. Risks And Mitigations

| Risk | Mitigation |
|---|---|
| WeChat phone authorization may be hard to test during development | Provide local mock and cloud test-user entry |
| Food auto-matching may miscount food | Use preview-confirm flow and only auto-match high-confidence results |
| Seed food quality affects perceived accuracy | Seed 100-200 high-frequency foods and aliases before MVP testing |
| Horizontal table may be dense on small screens | Use horizontal scrolling, compact columns, and readable system rows |
| Calculation mismatch between frontend and backend | Keep all core calculations in cloud shared modules |
| Profile change can shift today's target unexpectedly | Recalculate summary targets but keep record details unchanged |

## 16. Implementation Notes For Later Planning

- Initialize `.superpowers/` in `.gitignore` before code work if the project becomes a git repository.
- Create seed food data before validating Food Add.
- Treat mock mode as a development capability, not a formal product path.
- Write focused tests for plan calculation, food parsing, exercise burn, and daily summary recalculation.
