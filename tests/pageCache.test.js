const cache = require('../miniprogram/services/page-cache')

describe('page cache', () => {
  beforeEach(() => {
    cache.clearPageCache()
    jest.spyOn(Date, 'now').mockReturnValue(1000)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('returns cached data before ttl expires', () => {
    cache.setPageCache('home', { value: 1 })

    jest.spyOn(Date, 'now').mockReturnValue(1500)

    expect(cache.getPageCache('home', 1000)).toEqual({ value: 1 })
  })

  test('drops cached data after ttl expires', () => {
    cache.setPageCache('home', { value: 1 })

    jest.spyOn(Date, 'now').mockReturnValue(2501)

    expect(cache.getPageCache('home', 1000)).toBeNull()
  })
})
