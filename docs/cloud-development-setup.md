# 微信云开发接入说明

## 1. 填写环境 ID

在微信开发者工具中打开「云开发」，创建或选择环境，复制环境 ID。

然后修改：

```js
// miniprogram/app.js
globalData: {
  envId: '你的环境ID',
  useMock: false,
  userId: ''
}
```

## 2. 创建数据库集合

在云开发数据库中创建这些集合：

- `users`
- `user_plan`
- `foods`
- `daily_records`
- `daily_summary`

## 3. 上传并部署云函数

在微信开发者工具左侧找到 `cloudfunctions`，依次上传并部署：

- `loginByWechatPhone`
- `loginAsTestUser`
- `saveProfile`
- `getProfile`
- `getHomeData`
- `parseFoodInput`
- `addFoodRecords`
- `addExerciseRecord`
- `updateRecord`
- `deleteRecord`
- `getStats`
- `initFoods`

## 4. 初始化食物库

部署 `initFoods` 后，在云函数调试里调用一次：

```json
{}
```

期望返回：

```json
{
  "total": 117,
  "created": 117,
  "updated": 0
}
```

如果重复调用，会更新已有食物，返回里的 `updated` 会增加。

## 5. 验证云端闭环

1. 重新编译小程序。
2. 点击「测试用户登录」。
3. 如果进入资料完善页，填写资料并保存。
4. 新增饮食：`鸡胸肉200g，米饭150g，鸡蛋2个`。
5. 新增运动：中度力量 45min。
6. 回首页确认今日进度、营养素进度、记录表和趋势页都能读取云端数据。

正式手机号登录需要小程序 AppID、权限和微信手机号授权能力，建议在测试用户云端闭环跑通后再验证。
