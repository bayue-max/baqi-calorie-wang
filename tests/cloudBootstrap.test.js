describe('cloud bootstrap behavior', () => {
  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  test('test user login does not run bootstrap work during regular login', async () => {
    const createCollection = jest.fn().mockResolvedValue({})
    const get = jest.fn().mockResolvedValueOnce({ data: [] })
    const add = jest.fn().mockResolvedValue({ _id: 'user-1' })
    const collection = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get,
      add
    })
    const callFunction = jest.fn()

    jest.doMock('wx-server-sdk', () => ({
      DYNAMIC_CURRENT_ENV: 'dynamic',
      init: jest.fn(),
      callFunction,
      database: jest.fn(() => ({ createCollection, collection }))
    }), { virtual: true })

    const { main } = require('../cloudfunctions/loginAsTestUser')
    await main()

    expect(createCollection).not.toHaveBeenCalled()
    expect(callFunction).not.toHaveBeenCalled()
    expect(collection.mock.calls.map(call => call[0])).toEqual(['users', 'users'])
  })

  test('food parsing reads the existing food library without bootstrap work', async () => {
    const createCollection = jest.fn().mockResolvedValue({})
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            _id: 'chicken',
            name: '鸡胸肉',
            alias: ['鸡胸'],
            caloriesPer100g: 120,
            proteinPer100g: 23,
            fatPer100g: 2.5,
            carbPer100g: 0,
            unitConversions: { g: 1, 克: 1 },
            priority: 10,
            enabled: true
          }
        ]
      })
    const collection = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get
    })
    const callFunction = jest.fn().mockResolvedValue({ result: { total: 1, created: 1, updated: 0 } })

    jest.doMock('wx-server-sdk', () => ({
      DYNAMIC_CURRENT_ENV: 'dynamic',
      init: jest.fn(),
      callFunction,
      database: jest.fn(() => ({ createCollection, collection }))
    }), { virtual: true })

    const { main } = require('../cloudfunctions/parseFoodInput')
    const result = await main({ rawInput: '鸡胸肉200克' })

    expect(createCollection).not.toHaveBeenCalled()
    expect(callFunction).not.toHaveBeenCalled()
    expect(result.items[0]).toMatchObject({
      name: '鸡胸肉',
      gramEquivalent: 200,
      calories: 240
    })
  })

  test('wechat login uses openid without requiring phone authorization', async () => {
    const createCollection = jest.fn().mockResolvedValue({})
    const get = jest
      .fn()
      .mockResolvedValueOnce({ data: [] })
    const add = jest.fn().mockResolvedValue({ _id: 'user-openid-1' })
    const collection = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get,
      add
    })
    const getPhoneNumber = jest.fn()

    jest.doMock('wx-server-sdk', () => ({
      DYNAMIC_CURRENT_ENV: 'dynamic',
      init: jest.fn(),
      getWXContext: jest.fn(() => ({ OPENID: 'openid-1', UNIONID: '' })),
      openapi: {
        phonenumber: { getPhoneNumber }
      },
      database: jest.fn(() => ({ createCollection, collection }))
    }), { virtual: true })

    const { main } = require('../cloudfunctions/loginByWechatPhone')
    const result = await main({})

    expect(createCollection).not.toHaveBeenCalled()
    expect(getPhoneNumber).not.toHaveBeenCalled()
    expect(add).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountType: 'wechat',
        openid: 'openid-1',
        profileCompleted: false
      })
    })
    expect(result.user).toMatchObject({
      _id: 'user-openid-1',
      accountType: 'wechat',
      openid: 'openid-1'
    })
  })
})
