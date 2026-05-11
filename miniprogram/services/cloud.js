const mock = require('./mock-data')

function appState() {
  return getApp().globalData
}

async function callFunction(name, data = {}) {
  if ((appState().useMock || !appState().envId) && mock[name]) {
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
  getStats: data => callFunction('getStats', data),
  decomposeDish: data => callFunction('decomposeDish', data)
}
