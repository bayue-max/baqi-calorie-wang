function getBeijingDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(date)
}

function assertToday(dateString, now = new Date()) {
  const today = getBeijingDateString(now)
  if (dateString !== today) {
    throw new Error('MVP only supports editing Beijing-time today')
  }
}

module.exports = {
  getBeijingDateString,
  assertToday
}
