/**
 * 菜品分解缓存
 *
 * 缓存 AI 菜品分解结果，避免对同一菜名重复调用 AI。
 * 缓存层级：内存缓存（会话级）→ 云数据库 dish_cache（持久化）
 *
 * 自动创建：首次写入时如果 dish_cache 集合不存在，会自动创建。
 * 无需在控制台手动建表。
 */

const MEMORY_CACHE_TTL = 30 * 60 * 1000 // 30 分钟

/**
 * 简易内存缓存（进程级，单次云函数调用内共享）
 */
const memoryCache = new Map()

/**
 * 从内存缓存读取
 * @param {string} dishName
 * @returns {null|object}
 */
function getMemoryCache(dishName) {
  const entry = memoryCache.get(dishName)
  if (!entry) return null
  if (Date.now() - entry.timestamp > MEMORY_CACHE_TTL) {
    memoryCache.delete(dishName)
    return null
  }
  return entry.data
}

/**
 * 写入内存缓存
 * @param {string} dishName
 * @param {object} data
 */
function setMemoryCache(dishName, data) {
  memoryCache.set(dishName, { data, timestamp: Date.now() })
}

/**
 * 从云数据库 dish_cache 读取
 * @param {object} db - wx-server-sdk database instance
 * @param {string} dishName
 * @returns {null|object}
 */
async function getDishCache(db, dishName) {
  try {
    const result = await db.collection('dish_cache').doc(dishName).get()
    return result.data || null
  } catch (e) {
    // 文档不存在或网络错误
    return null
  }
}

/**
 * 写入云数据库 dish_cache（自动创建集合）
 * @param {object} db - wx-server-sdk database instance
 * @param {string} dishName
 * @param {object} data - { dishName, confidence, oilIncluded, ingredients, ... }
 */
async function setDishCache(db, dishName, data) {
  try {
    const now = Date.now()
    const existing = await db.collection('dish_cache').doc(dishName).get()
    if (existing.data) {
      await db.collection('dish_cache').doc(dishName).update({
        data: { ...data, hitCount: db.command.inc(1), updatedAt: now }
      })
    } else {
      await db.collection('dish_cache').add({
        data: { _id: dishName, ...data, hitCount: 1, createdAt: now, updatedAt: now }
      })
    }
  } catch (e) {
    // 集合不存在 → 自动创建后重试
    if (e.message && e.message.includes('Collection does not exist')) {
      try {
        await db.createCollection('dish_cache')
        // 创建成功后重试写入
        await db.collection('dish_cache').add({
          data: { _id: dishName, ...data, hitCount: 1, createdAt: Date.now(), updatedAt: Date.now() }
        })
        return
      } catch (createErr) {
        console.warn('[dishCache] createCollection failed:', createErr.message)
      }
    }
    console.warn('[dishCache] write failed:', dishName, e.message)
  }
}

/**
 * 清空内存缓存（主要用于测试，生产环境不建议调用）
 */
function clearMemoryCache() {
  memoryCache.clear()
}

module.exports = {
  getMemoryCache,
  setMemoryCache,
  clearMemoryCache,
  getDishCache,
  setDishCache
}
