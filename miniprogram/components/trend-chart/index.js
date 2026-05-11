Component({
  properties: {
    points: { type: Array, value: [] },
    bmr: { type: Number, value: 0 },
    targetCalories: { type: Number, value: 0 },
    totalBurnCalories: { type: Number, value: 0 },
    range: { type: Object, value: null },
    mode: { type: String, value: 'week' }
  },

  observers: {
    'points,bmr,targetCalories,totalBurnCalories,range,mode': function () {
      if (this._drawReady) this.draw()
    }
  },

  lifetimes: {
    ready() {
      this._drawReady = false
      this._pointPositions = []
      setTimeout(() => {
        this._drawReady = true
        this.draw()
      }, 400)
    }
  },

  methods: {
    draw() {
      if (!this._drawReady) return
      if (this._drawing) { this._redrawNeeded = true; return }
      this._drawing = true
      this._redrawNeeded = false
      var that = this
      const query = this.createSelectorQuery()
      query.select('#trendCanvas').fields({ node: true, size: true }).exec(function(res) {
        that._drawing = false
        const canvasInfo = res[0]
        if (!canvasInfo || !canvasInfo.node) {
          if (that._redrawNeeded) that.draw()
          return
        }
        const canvas = canvasInfo.node
        const ctx = canvas.getContext('2d')
        const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
        const dpr = win.pixelRatio
        canvas.width = canvasInfo.width * dpr
        canvas.height = canvasInfo.height * dpr
        ctx.scale(dpr, dpr)
        that._canvasWidth = canvasInfo.width
        that._canvasHeight = canvasInfo.height
        that.drawChart(ctx, canvasInfo.width, canvasInfo.height)
        if (that._redrawNeeded) that.draw()
      })
    },

    drawChart(ctx, width, height) {
      const isMonth = this.data.mode === 'month'
      const padding = { left: 40, right: 22, top: 20, bottom: 46 }
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const rpx = (win.windowWidth || 375) / 750
      const weekCanvasHeight = 602 * rpx
      const dateRowStep = (weekCanvasHeight - padding.top - padding.bottom) / 6
      const dateRows = this.buildDateRows()
      const pointMap = {}
      ;(this.data.points || []).forEach(point => {
        pointMap[point.date] = point
      })
      const baseSuggestedCalories = Number(this.data.targetCalories || 0)
      const points = dateRows.map(date => {
        const source = pointMap[date]
        const dynamicTargetCalories = source && source.dynamicTargetCalories
          ? Number(source.dynamicTargetCalories)
          : baseSuggestedCalories
        const totalBurnCalories = source && source.totalBurnCalories
          ? Number(source.totalBurnCalories)
          : dynamicTargetCalories + 350

        return {
          date,
          foodCalories: source ? Number(source.foodCalories || 0) : null,
          dynamicTargetCalories,
          totalBurnCalories,
          hasValue: !!source
        }
      })
        .slice()
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      const values = points.filter(point => point.hasValue).map(point => Number(point.foodCalories || 0))
      const targetValues = points.map(point => Number(point.dynamicTargetCalories || 0))
      const totalBurnValues = points.map(point => Number(point.totalBurnCalories || 0))
      const maxValue = this.roundAxisMax(Math.max(...targetValues, ...totalBurnValues, ...values, 1))
      const innerWidth = width - padding.left - padding.right
      const innerHeight = height - padding.top - padding.bottom
      const xForValue = value => padding.left + (Number(value || 0) / maxValue) * innerWidth
      const yForIndex = index => {
        if (points.length <= 1) return padding.top + innerHeight
        const spanHeight = Math.min(innerHeight, dateRowStep * (points.length - 1))
        return padding.top + spanHeight - index * dateRowStep
      }

      ctx.clearRect(0, 0, width, height)
      this.drawDecorations(ctx, width, height, padding)
      this.drawAxis(ctx, width, height, padding, points, yForIndex, maxValue, xForValue)
      this.drawDynamicGuideLine(ctx, points, 'dynamicTargetCalories', xForValue, yForIndex, padding, '#ff6b10', 20)
      this.drawDynamicGuideLine(ctx, points, 'totalBurnCalories', xForValue, yForIndex, padding, '#7b4a24', 36)

      const valuedPoints = points
        .map((point, index) => ({ ...point, x: xForValue(point.foodCalories), y: yForIndex(index) }))
        .filter(point => point.hasValue)

      var that = this
      that._pointPositions = points.map(function(p, i) {
        return { x: xForValue(p.foodCalories), y: yForIndex(i), date: p.date, burn: p.totalBurnCalories, target: p.dynamicTargetCalories, food: p.foodCalories }
      })

      ctx.strokeStyle = '#ff6b10'
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      valuedPoints.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.stroke()

      valuedPoints.forEach(point => this.drawPointLabel(ctx, point.foodCalories, point.x, point.y, width, padding))

      // 画布层级浮标
      if (that.data.tooltip) {
        that.drawTooltipOnCanvas(ctx)
      }
    },

    drawDevGuideLine(ctx, points, field, xForValue, yForIndex, padding, color, labelY) {
      const targetPoints = points.map((point, index) => ({
        x: xForValue(point[field]),
        y: yForIndex(index),
        value: point[field]
      }))
      if (!targetPoints.length) return

      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 6])
      ctx.beginPath()
      targetPoints.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    },

    drawAxis(ctx, width, height, padding, points, yForIndex, maxValue, xForValue) {
      ctx.strokeStyle = '#e8d8c6'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padding.left, padding.top)
      ctx.lineTo(padding.left, height - padding.bottom)
      ctx.lineTo(width - padding.right, height - padding.bottom)
      ctx.stroke()

      points.forEach((point, index) => {
        const y = yForIndex(index)
        ctx.strokeStyle = '#f4eadc'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(width - padding.right, y)
        ctx.stroke()
        this.drawDateTick(ctx, point.date, y, padding)
      })

      const ticks = this.buildTicks(maxValue)
      const axisY = height - padding.bottom
      const labelY = axisY + 22
      ticks.forEach(tick => {
        const x = xForValue(tick)
        ctx.fillStyle = '#45536a'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(String(tick), x, labelY)
      })
      ctx.textAlign = 'right'
      ctx.fillStyle = '#45536a'
      ctx.font = '10px sans-serif'
      ctx.fillText('kcal', width - padding.right, axisY + 38)
    },

    buildDateRows() {
      const range = this.data.range || {}
      const start = this.parseDate(range.start)
      const rangeEnd = this.parseDate(range.end)
      if (!start || !rangeEnd) { return (this.data.points || []).map(point => point.date) }
      const today = this.parseDate(this.getToday())
      const end = rangeEnd && today && rangeEnd > today ? today : rangeEnd
      const rows = []
      const cursor = new Date(start)
      while (cursor <= end && rows.length < 31) {
        rows.push(this.formatDate(cursor))
        cursor.setDate(cursor.getDate() + 1)
      }
      return rows
    },

    parseDate(date) { const parts = String(date || '').split('-').map(Number); if (!parts[0] || !parts[1] || !parts[2]) return null; return new Date(parts[0], parts[1] - 1, parts[2]) },
    formatDate(date) { return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-') },
    getToday() { return this.formatDate(new Date()) },
    roundAxisMax(value) { return Math.max(3000, Math.ceil((Number(value || 0) + 300) / 500) * 500) },
    buildTicks(maxValue) { var ticks = []; for (var value = 1000; value <= maxValue; value += 500) ticks.push(value); return ticks },

    // 触摸交互：在 Canvas 上绘浮标
    onTouch(e) {
      var touch = e.touches[0]
      var points = this._pointPositions || []
      var closest = null
      var minDist = 40
      for (var i = 0; i < points.length; i++) {
        var p = points[i]
        var d = Math.sqrt((touch.x-p.x)*(touch.x-p.x) + (touch.y-p.y)*(touch.y-p.y))
        if (d < minDist) { minDist = d; closest = p }
      }
      if (closest) {
        var wd = '周' + ['日','一','二','三','四','五','六'][new Date(Date.parse(closest.date.replace(/-/g,'/'))).getDay()]
        this.setData({ tooltip: { date: closest.date, weekday: wd, burn: Math.round(closest.burn||0), target: Math.round(closest.target||0), food: closest.food !== null ? Math.round(closest.food) : '-' } }, function(){ this.draw() })
      }
    },

    onTouchEnd() {
      this.setData({ tooltip: null }, function(){ this.draw() })
    },

    drawTooltipOnCanvas(ctx) {
      var t = this.data.tooltip; if (!t) return
      var x = 50, y = 30, tw = 130, th = 96, r = 8
      ctx.save()
      ctx.fillStyle = '#fff7ec'
      ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+tw-r,y); ctx.quadraticCurveTo(x+tw,y,x+tw,y+r); ctx.lineTo(x+tw,y+th-r); ctx.quadraticCurveTo(x+tw,y+th,x+tw-r,y+th); ctx.lineTo(x+r,y+th); ctx.quadraticCurveTo(x,y+th,x,y+th-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,122,16,0.45)'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.fillStyle = '#202733'; ctx.font = 'bold 11px sans-serif'
      ctx.fillText(t.date + ' ' + t.weekday, x + 10, y + 20)
      ctx.font = '10px sans-serif'
      ctx.fillStyle = '#7b4a24'; ctx.fillText('总消耗 ' + t.burn + ' kcal', x + 10, y + 40)
      ctx.fillStyle = '#ff7a10'; ctx.fillText('建议摄入 ' + t.target + ' kcal', x + 10, y + 56)
      ctx.fillStyle = '#ff6b10'; ctx.fillText('实际摄入 ' + t.food + ' kcal', x + 10, y + 72)
      ctx.restore()
    },

    drawDecorations(ctx, width, height, padding) {
      ctx.save()
      ctx.strokeStyle = 'rgba(255, 122, 16, 0.08)'
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.moveTo(padding.left + 44, padding.top + 170)
      ctx.bezierCurveTo(width - 80, padding.top + 80, width - 90, padding.top + 310, padding.left + 92, padding.top + 270)
      ctx.bezierCurveTo(width - 60, padding.top + 350, width - 90, padding.top + 520, padding.left + 140, padding.top + 490)
      ctx.stroke()
      var paws = [[padding.left + 160, padding.top + 164],[padding.left + 58, padding.top + 300],[width - 86, padding.top + 360],[padding.left + 150, padding.top + 438]]
      for (var i = 0; i < paws.length; i++) { this.drawPaw(ctx, paws[i][0], paws[i][1]) }
      ctx.restore()
    },

    drawPaw(ctx, x, y) {
      ctx.fillStyle = 'rgba(255, 122, 16, 0.13)'
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x - 8, y - 9, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y - 12, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + 8, y - 9, 3, 0, Math.PI * 2)
      ctx.fill()
    },

    drawDynamicGuideLine(ctx, points, field, xForValue, yForIndex, padding, color, labelY) {
      var targetPoints = points.map(function(point, index) { return { x: xForValue(point[field]), y: yForIndex(index), value: point[field] } })
      if (!targetPoints.length) return
      ctx.save()
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6])
      ctx.beginPath()
      targetPoints.forEach(function(point, index) { if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y) })
      ctx.stroke(); ctx.setLineDash([]); ctx.restore()
    },

    drawDateTick(ctx, date, y, padding) {
      var isToday = date === this.getToday()
      ctx.strokeStyle = isToday ? '#ff6b10' : '#c7c7c7'; ctx.lineWidth = 1; ctx.beginPath()
      ctx.moveTo(padding.left - 6, y); ctx.lineTo(padding.left, y); ctx.stroke()
      ctx.fillStyle = isToday ? '#ff6b10' : '#45536a'; ctx.font = isToday ? 'bold 11px sans-serif' : '10px sans-serif'
      ctx.textAlign = 'right'
      var lines = this.formatDateLabel(date, isToday).split('\n')
      ctx.fillText(lines[0], padding.left - 6, y - 2)
      if (lines[1]) ctx.fillText(lines[1], padding.left - 6, y + 14)
      ctx.fillStyle = isToday ? '#ff6b10' : '#bfc2c7'
      ctx.beginPath(); ctx.arc(padding.left, y, isToday ? 4 : 3, 0, Math.PI * 2); ctx.fill()
      ctx.textAlign = 'left'
    },

    formatDateLabel(date, isToday) { var parts = String(date).split('-').map(Number); var wd = ['日','一','二','三','四','五','六'][new Date(parts[0], parts[1]-1, parts[2]).getDay()]; return parts[1]+'/'+parts[2]+'\n' + (isToday ? '今天' : '周'+wd) },

    drawPointLabel(ctx, value, x, y, width, padding) {
      var label = '' + Math.round(Number(value || 0))
      var preferRight = x < width - padding.right - 48
      var labelX = preferRight ? x + 14 : x - 14
      var labelY = y - 12 < padding.top ? y + 22 : y - 10
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#ff6b10'; ctx.lineWidth = 3; ctx.stroke()
      ctx.fillStyle = '#202733'; ctx.font = '11px sans-serif'; ctx.textAlign = preferRight ? 'left' : 'right'
      ctx.fillText(label, labelX, labelY); ctx.textAlign = 'left'
    }
  }
})
