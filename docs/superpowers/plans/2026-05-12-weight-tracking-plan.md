# 体重追踪 详细实施计划

> 父规划：docs/iteration-plan.md Phase 1
> 目标：完整体重追踪 — 记录、趋势、目标管理、方案联动

---

## 架构概览

```
weight_records (DB 集合)
    ↓
addWeightRecord / getWeightRecords (云函数)
    ↓
cache / getHomeData 扩展 (云函数)
    ↓
首页体重卡片 + 趋势体重模式 + 资料目标体重 (前端)
```

---

## Task 1：数据库 + 云函数

### Step 1: 新增 `weight_records` 集合
在云开发控制台创建集合，或在 `initFoods` 同目录下新增初始化脚本。

字段设计：
```json
{
  "_id": "auto",
  "userId": "user_xxx",
  "date": "2026-05-12",       // 北京日期，每天一条
  "weight": 72.5,              // kg，精确到 0.1
  "note": "空腹称重",           // 可选备注
  "createdAt": 1715500800000,
  "updatedAt": 1715500800000
}
```
唯一索引：`userId + date`（upsert 语义）

### Step 2: 新增云函数 `addWeightRecord`
**文件：** `cloudfunctions/addWeightRecord/index.js`、`package.json`

```js
exports.main = async event => {
  const { userId, weight, note, date } = event   // date 可选，默认今天
  if (!userId || weight == null) throw new Error('Missing userId or weight')
  if (!Number.isFinite(weight) || weight <= 0 || weight > 500)
    throw new Error('Invalid weight')
  const recordDate = date || getBeijingDateString()
  // upsert: 同一日期覆盖
  const existing = await db.collection('weight_records')
    .where({ userId, date: recordDate }).limit(1).get()
  const data = { userId, date: recordDate, weight: Number(weight),
    note: note || '', updatedAt: Date.now() }
  if (existing.data.length) {
    await db.collection('weight_records').doc(existing.data[0]._id).update({ data })
    return { record: { ...existing.data[0], ...data }, updated: true }
  }
  const added = await db.collection('weight_records')
    .add({ data: { ...data, createdAt: Date.now() } })
  return { record: { _id: added._id, ...data }, updated: false }
}
```

### Step 3: 新增云函数 `getWeightRecords`
**文件：** `cloudfunctions/getWeightRecords/index.js`、`package.json`

```js
exports.main = async event => {
  const { userId, mode = 'month', start, end } = event
  if (!userId) throw new Error('Missing userId')
  const now = new Date()
  const range = start && end ? { start, end } : dateRange(mode, now)
  const records = await db.collection('weight_records')
    .where({ userId, date: _.gte(range.start).and(_.lte(range.end)) })
    .orderBy('date', 'asc').get()

  // 统计
  const first = records.data[0]
  const last = records.data[records.data.length - 1]
  const change = first && last ? Math.round((last.weight - first.weight) * 10) / 10 : 0
  const trend = change < 0 ? 'down' : change > 0 ? 'up' : 'stable'

  return {
    mode, range,
    records: records.data,
    stats: {
      firstWeight: first ? first.weight : null,
      latestWeight: last ? last.weight : null,
      change, trend,
      recordCount: records.data.length
    }
  }
}
```

### Step 4: 扩展 `getHomeData` 返回体重信息
在 `getHomeData/index.js` 中增加体重查询，返回：
```js
weight: { latest, change, trend }  // 取最近一条 + 与三周前对比
```

### Step 5: 扩展 `saveProfile` — 体重变更时自动记录
当用户修改资料中的体重时，自动调用 `addWeightRecord` 写入一条记录。这样初始体重不会丢失。

---

## Task 2：前端 — 首页体重卡片

### Step 1: `home/index.js` 数据扩展
在 `applyHomeData` 中处理 weight 字段：
```js
weight: data.weight,  // { latest, change, trend }
```

### Step 2: `home/index.wxml` 体重卡片
在营养卡片（`.nutrition-card`）下方插入：
```xml
<view class="weight-card" wx:if="{{weight && weight.latest}}">
  <view class="weight-main">
    <text class="weight-value">{{weight.latest}}</text>
    <text class="weight-unit">kg</text>
    <view class="weight-change {{weight.trend}}">
      <text>{{weight.change >= 0 ? '+' : ''}}{{weight.change}} kg</text>
      <text>近30天</text>
    </view>
  </view>
  <button class="weight-record-btn" bindtap="openWeightModal">记录体重</button>
</view>
```

### Step 3: 体重记录弹窗
类似食物/运动弹窗的模态框，包含：
- 体重输入（数字，默认回填上次记录值）
- 可选备注
- 保存/取消按钮

### Step 4: 体重变化 ≥2kg 提示
在 `applyHomeData` 中检测 `weight.change` 绝对值 ≥ 2 时，显示提示条：
```
体重已变化 2.5kg，建议重新评估热量方案 → [去更新]
```
点击跳转 `profile-edit` 页。

---

## Task 3：前端 — 趋势页体重模式

### Step 1: `trends/index.js` 扩展
增加 `dataMode` 字段（`'calories'` / `'weight'`），`onShow` 时同时加载体重数据。

```js
data: {
  mode: 'week',
  dataMode: 'calories',   // 新增
  stats: null,
  weightRecords: null,    // 新增
  loading: true
}
```

### Step 2: `trends/index.wxml` 数据模式切换
在 mode-tabs 上方增加：
```xml
<view class="data-mode-tabs">
  <button class="{{dataMode === 'calories' ? 'active' : ''}}"
    data-data-mode="calories" bindtap="switchDataMode">热量</button>
  <button class="{{dataMode === 'weight' ? 'active' : ''}}"
    data-data-mode="weight" bindtap="switchDataMode">体重</button>
</view>
```

热量模式：显示现有 `trend-chart`
体重模式：显示新增 `weight-chart` 组件

### Step 3: 新增 `weight-chart` 组件
**文件：** `miniprogram/components/weight-chart/index.{js,json,wxml,wxss}`

简化版 Canvas 图表，props：
- `points`: [{date, weight}] 
- `targetWeight`: 目标体重（展示为目标线，如果有）

图表特性：
- Y 轴：体重 kg（自动范围）
- X 轴：日期
- 目标体重虚线（如果用户设定了目标体重）
- 当天数据点高亮

---

## Task 4：前端 — 资料页扩展

### Step 1: `profile-edit` 增加目标体重字段
在"身体数据"区域、体重下方增加：
```xml
<view class="field">
  <text class="label">目标体重 kg</text>
  <input type="digit" value="{{targetWeight}}" data-field="targetWeight"
    bindinput="updateField" placeholder="65" />
</view>
```
保存时加入 `targetWeight` 字段。

### Step 2: `profile` 页展示 BMI 和体重进度
在热量计划卡片上方增加 BMI 信息行：
```xml
<view class="bmi-row" wx:if="{{user.weight && user.height}}">
  <text>BMI {{bmi}}</text>
  <text class="bmi-label">{{bmiLabel}}</text>
</view>
```
BMI 公式：`体重 / (身高/100)²`，分级：偏瘦 <18.5 / 正常 18.5-24 / 偏胖 24-28 / 肥胖 ≥28

如果有目标体重，展示进度：
```xml
<view class="weight-progress">
  <text>距目标体重还差 {{remainingWeight}} kg</text>
  <view class="progress-bar"><view style="width: {{weightProgressPercent}}%"></view></view>
</view>
```

---

## Task 5：联动与测试

### Step 1: `saveProfile` 联动
修改 `saveProfile` 云函数：当 `weight` 字段变更时，自动写入 `weight_records`。

```js
// saveProfile/index.js 中添加
const oldUser = (await db.collection('users').doc(userId).get()).data
if (oldUser.weight !== profile.weight) {
  await cloud.callFunction({ name: 'addWeightRecord', data: {
    userId, weight: profile.weight, note: '更新资料时自动记录'
  }})
}
```

### Step 2: 云函数前端接口注册
`miniprogram/services/cloud.js` 增加：
```js
addWeightRecord: data => callFunction('addWeightRecord', data),
getWeightRecords: data => callFunction('getWeightRecords', data),
```

### Step 3: Mock 数据更新
`miniprogram/services/mock-data.js` 增加 mock 体重记录数据。

### Step 4: 单元测试
新增 `tests/weight.test.js`：测试 BMI 计算、体重变化量计算。

---

## 文件清单

| 类型 | 文件 | 操作 |
|---|---|---|
| 云函数 | `cloudfunctions/addWeightRecord/index.js` | 新建 |
| 云函数 | `cloudfunctions/addWeightRecord/package.json` | 新建 |
| 云函数 | `cloudfunctions/getWeightRecords/index.js` | 新建 |
| 云函数 | `cloudfunctions/getWeightRecords/package.json` | 新建 |
| 云函数 | `cloudfunctions/getHomeData/index.js` | 修改（增加体重查询） |
| 云函数 | `cloudfunctions/saveProfile/index.js` | 修改（自动记体重） |
| 前端 | `miniprogram/pages/home/index.js` | 修改（体重数据+弹窗） |
| 前端 | `miniprogram/pages/home/index.wxml` | 修改（体重卡片+弹窗） |
| 前端 | `miniprogram/pages/home/index.wxss` | 修改（体重卡片样式） |
| 前端 | `miniprogram/pages/trends/index.js` | 修改（体重模式） |
| 前端 | `miniprogram/pages/trends/index.wxml` | 修改（模式切换） |
| 前端 | `miniprogram/pages/trends/index.wxss` | 修改 |
| 前端 | `miniprogram/pages/profile-edit/index.js` | 修改（目标体重） |
| 前端 | `miniprogram/pages/profile-edit/index.wxml` | 修改（目标体重字段） |
| 前端 | `miniprogram/pages/profile/index.js` | 修改（BMI+进度） |
| 前端 | `miniprogram/pages/profile/index.wxml` | 修改（BMI+进度） |
| 前端 | `miniprogram/pages/profile/index.wxss` | 修改 |
| 组件 | `miniprogram/components/weight-chart/index.*` | 新建 |
| 前端 | `miniprogram/services/cloud.js` | 修改（新接口） |
| 前端 | `miniprogram/services/mock-data.js` | 修改（mock 体重） |
| 测试 | `tests/weight.test.js` | 新建 |
