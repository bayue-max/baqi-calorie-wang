const store = {}

function setPageCache(key, data) {
  store[key] = {
    data,
    savedAt: Date.now()
  }
}

function getPageCache(key, ttl = 30000) {
  const entry = store[key]
  if (!entry) return null
  if (Date.now() - entry.savedAt > ttl) {
    delete store[key]
    return null
  }
  return entry.data
}

function clearPageCache(key) {
  if (key) {
    delete store[key]
    return
  }
  Object.keys(store).forEach(name => delete store[name])
}

module.exports = {
  setPageCache,
  getPageCache,
  clearPageCache
}
