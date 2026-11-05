export function getPlantStatus(plant) {
  const { moisture } = plant.current
  if (moisture > plant.moistureMax) return { label: '과습 주의', tone: 'danger' }
  if (moisture <= plant.wateringThreshold) return { label: '관리 확인 필요', tone: 'warning' }
  return { label: '정상 관리 중', tone: 'healthy' }
}

export function predictWatering(plant) {
  const readings = plant.readings.filter((reading) => Date.now() - new Date(reading.timestamp).getTime() <= 14 * 24 * 60 * 60 * 1000)
  if (readings.length < 5) return { status: 'insufficient', reason: '분석에 필요한 측정 데이터가 부족합니다.' }

  const origin = new Date(readings[0].timestamp).getTime()
  const smoothed = readings.map((reading, index) => {
    const window = readings.slice(Math.max(0, index - 2), index + 1)
    return { day: (new Date(reading.timestamp).getTime() - origin) / (24 * 60 * 60 * 1000), moisture: window.reduce((sum, item) => sum + item.moisture, 0) / window.length }
  })
  const meanX = smoothed.reduce((sum, point) => sum + point.day, 0) / smoothed.length
  const meanY = smoothed.reduce((sum, point) => sum + point.moisture, 0) / smoothed.length
  const denominator = smoothed.reduce((sum, point) => sum + (point.day - meanX) ** 2, 0)
  const slope = smoothed.reduce((sum, point) => sum + (point.day - meanX) * (point.moisture - meanY), 0) / denominator
  const rate = -slope
  const variance = smoothed.reduce((sum, point) => sum + (point.moisture - (meanY + slope * (point.day - meanX))) ** 2, 0) / smoothed.length

  if (!Number.isFinite(rate) || rate < 0.15 || variance > 90) {
    return { status: 'uncertain', rate: Math.max(0, rate), reason: '최근 수분 추세가 불안정해 도달 시점을 신뢰성 있게 계산하기 어렵습니다.' }
  }
  const days = Math.max(0, (plant.current.moisture - plant.wateringThreshold) / rate)
  return { status: 'ready', rate, days, variance, period: '최근 14일', reason: `최근 ${readings.length}개 측정값을 3회 이동평균으로 완화한 뒤 선형 감소 추세를 계산했습니다.` }
}

export function deriveAlerts(plants, devices) {
  const alerts = []
  plants.forEach((plant) => {
    const status = getPlantStatus(plant)
    if (status.tone === 'warning') alerts.push({ id: `rule-low-${plant.id}`, plantId: plant.id, type: '수분 부족', level: '주의', status: '주의', message: '토양 수분이 설정한 급수 기준보다 낮습니다.', timestamp: plant.current.timestamp })
    if (status.tone === 'danger') alerts.push({ id: `rule-high-${plant.id}`, plantId: plant.id, type: '과습 위험', level: '위험', status: '위험', message: '상한 기준을 넘었습니다. 자동 급수를 일시 중지하세요.', timestamp: plant.current.timestamp })
    const device = devices.find((item) => item.id === plant.deviceId)
    if (plant.deviceId && (!device || !device.connected)) alerts.push({ id: `rule-device-${plant.id}`, plantId: plant.id, type: '센서 연결 확인', level: '주의', status: '주의', message: '기기 연결이 끊겨 새 측정값을 받을 수 없습니다.', timestamp: device?.lastSeen ?? plant.current.timestamp })
    if (Date.now() - new Date(plant.current.timestamp).getTime() > 24 * 60 * 60 * 1000) alerts.push({ id: `rule-stale-${plant.id}`, plantId: plant.id, type: '센서 갱신 지연', level: '주의', status: '주의', message: '측정값이 24시간 이상 갱신되지 않았습니다.', timestamp: plant.current.timestamp })
  })
  return alerts
}
