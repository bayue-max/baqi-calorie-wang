async function ensureCollections(db, names) {
  for (const name of names) {
    try {
      await db.createCollection(name)
    } catch (error) {
      const message = String(error && (error.errMsg || error.message || error))
      if (!message.includes('collection already exists') && !message.includes('already exists')) {
        throw error
      }
    }
  }
}

async function ensureFoodLibrary(db, cloud) {
  const existing = await db.collection('foods').where({ enabled: true }).limit(1).get()
  if (existing.data.length === 0) {
    await cloud.callFunction({ name: 'initFoods' })
  }
}

module.exports = {
  ensureCollections,
  ensureFoodLibrary
}
