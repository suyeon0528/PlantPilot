const now = Date.now()
const ago = (hours) => new Date(now - hours * 60 * 60 * 1000).toISOString()

const makeReadings = (base, offset = 0) =>
  Array.from({ length: 721 }, (_, index) => {
    const hoursAgo = 720 - index
    const daysAgo = hoursAgo / 24
    const event = index === 680 ? '급수' : null
    const postWaterBoost = index >= 680 ? 9 * (1 - (index - 680) / 40) : 0
    const moisture = Math.max(12, Math.min(75, base + offset + daysAgo * 0.65 + postWaterBoost + Math.sin(index * 1.7) * 1.1))
    return {
      id: `${index}-${hoursAgo}`,
      timestamp: ago(hoursAgo),
      moisture: index === 120 ? base : Math.round(moisture),
      temperature: Math.round((23.5 + Math.sin(index * 0.47) * 2.2) * 10) / 10,
      humidity: Math.round(54 + Math.sin(index * 0.35) * 10),
      light: Math.round(720 + Math.sin(index * 0.83) * 280),
      event,
    }
  })

export const initialPlants = [
  {
    id: 'monstera',
    name: '몬스테라',
    species: '몬스테라 델리시오사',
    image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=900&q=85',
    deviceId: 'device-01',
    moistureMin: 30,
    moistureMax: 65,
    temperatureMin: 18,
    temperatureMax: 29,
    autoWatering: false,
    wateringThreshold: 30,
    current: { moisture: 42, temperature: 24, humidity: 58, light: 850, timestamp: ago(0.15) },
    readings: makeReadings(42),
    lastWatered: ago(40),
  },
  {
    id: 'stuckyi',
    name: '스투키',
    species: '산세베리아 스투키',
    image: 'https://images.unsplash.com/photo-1593482892290-f54927ae2b0c?auto=format&fit=crop&w=900&q=85',
    deviceId: 'device-02',
    moistureMin: 25,
    moistureMax: 60,
    temperatureMin: 18,
    temperatureMax: 30,
    autoWatering: false,
    wateringThreshold: 25,
    current: { moisture: 21, temperature: 23, humidity: 45, light: 600, timestamp: ago(0.3) },
    readings: makeReadings(21),
    lastWatered: ago(112),
  },
  {
    id: 'pothos',
    name: '스킨답서스',
    species: '에피프렘넘 아우레움',
    image: 'https://images.unsplash.com/photo-1616690245152-3f3a5fba6efb?auto=format&fit=crop&w=900&q=85',
    deviceId: null,
    moistureMin: 30,
    moistureMax: 65,
    temperatureMin: 18,
    temperatureMax: 29,
    autoWatering: false,
    wateringThreshold: 30,
    current: { moisture: 56, temperature: 25, humidity: 62, light: 1100, timestamp: ago(0.5) },
    readings: makeReadings(56),
    lastWatered: ago(28),
  },
]

export const initialDevices = [
  { id: 'device-01', name: 'PlantPilot Device 01', model: 'ESP32 기반 IoT 기기', connected: true, plantId: 'monstera', lastSeen: ago(0.15), pumpOn: false },
  { id: 'device-02', name: 'PlantPilot Device 02', model: 'ESP32 기반 IoT 기기', connected: true, plantId: 'stuckyi', lastSeen: ago(0.3), pumpOn: false },
]

export const initialWatering = [
  { id: 'water-demo', plantId: 'monstera', timestamp: ago(40), before: 31, after: 42, amount: 120, status: '완료', demo: true },
  { id: 'water-stuckyi', plantId: 'stuckyi', timestamp: ago(112), before: 35, after: 48, amount: 90, status: '완료', demo: true },
]

export const initialAlerts = [
  { id: 'alert-low-stuckyi', plantId: 'stuckyi', type: '수분 부족', level: '주의', status: '주의', message: '토양 수분이 설정한 급수 기준보다 낮습니다.', timestamp: ago(0.25) },
]

export const initialJournal = [
  { id: 'journal-demo', plantId: 'monstera', type: '관리 기록', note: '잎이 건강하게 자라고 있어요. 창가 쪽으로 위치를 조금 옮겼습니다.', timestamp: ago(72), image: '' },
]

export const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
