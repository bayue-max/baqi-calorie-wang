const {
  AUTH_SESSION_KEY,
  getResumeTarget,
  readAuthSession,
  saveAuthSession
} = require('../miniprogram/services/auth-session')

function createStorage(initialValue) {
  let value = initialValue
  return {
    getStorageSync: jest.fn(() => value),
    setStorageSync: jest.fn((key, nextValue) => {
      value = nextValue
    })
  }
}

describe('auth session', () => {
  test('saves user id, profile status and privacy agreement', () => {
    const storage = createStorage()

    const session = saveAuthSession({
      user: { _id: 'user-1', profileCompleted: true },
      privacyAgreed: true
    }, storage)

    expect(storage.setStorageSync).toHaveBeenCalledWith(AUTH_SESSION_KEY, {
      userId: 'user-1',
      profileCompleted: true,
      privacyAgreed: true
    })
    expect(session).toEqual({
      userId: 'user-1',
      profileCompleted: true,
      privacyAgreed: true
    })
  })

  test('reads valid stored session and chooses resume target', () => {
    const storage = createStorage({
      userId: 'user-1',
      profileCompleted: false,
      privacyAgreed: true
    })

    const session = readAuthSession(storage)

    expect(session.userId).toBe('user-1')
    expect(getResumeTarget(session)).toBe('/pages/profile-edit/index')
    expect(getResumeTarget({ ...session, profileCompleted: true })).toBe('/pages/home/index')
  })

  test('ignores incomplete stored session', () => {
    const storage = createStorage({ privacyAgreed: true })

    expect(readAuthSession(storage)).toBeNull()
    expect(getResumeTarget(null)).toBe('')
  })
})
