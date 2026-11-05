import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createId, initialAlerts, initialDevices, initialJournal, initialPlants, initialWatering } from '../data/mockData'
import { deriveAlerts } from '../utils/analysis'

const STORAGE_KEY = 'plantpilot-demo-v1'
const AppContext = createContext(null)
const initialState = () => ({ plants: initialPlants, devices: initialDevices, watering: initialWatering, alerts: initialAlerts, journal: initialJournal })

function readState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? { ...initialState(), ...JSON.parse(saved) } : initialState()
  } catch (error) {
    console.error('PlantPilot demo data could not be loaded from localStorage.', error)
    return initialState()
  }
}

export function AppProvider({ children }) {
  const [state, setState] = useState(readState)
  const [pumpBusy, setPumpBusy] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const addPlant = (values) => setState((current) => {
    const id = createId()
    const timestamp = new Date().toISOString()
    return {
      ...current,
      plants: [...current.plants, { ...values, id, deviceId: values.deviceId || null, autoWatering: false, lastWatered: null, current: { moisture: 40, temperature: 23, humidity: 50, light: 700, timestamp }, readings: [{ id: createId(), timestamp, moisture: 40, temperature: 23, humidity: 50, light: 700 }] }],
      devices: current.devices.map((device) => device.id === values.deviceId ? { ...device, plantId: id } : device),
    }
  })
  const updatePlant = (id, patch) => setState((current) => {
    const plant = current.plants.find((item) => item.id === id)
    if (!plant) return current
    const nextDeviceId = patch.deviceId === undefined ? plant.deviceId : patch.deviceId || null
    return {
      ...current,
      plants: current.plants.map((item) => item.id === id ? { ...item, ...patch, deviceId: nextDeviceId } : item),
      devices: patch.deviceId === undefined ? current.devices : current.devices.map((device) => {
        if (device.id === nextDeviceId) return { ...device, plantId: id }
        if (device.id === plant.deviceId && device.plantId === id) return { ...device, plantId: null }
        return device
      }),
    }
  })
  const deletePlant = (id) => setState((current) => {
    const plant = current.plants.find((item) => item.id === id)
    return { ...current, plants: current.plants.filter((item) => item.id !== id), devices: current.devices.map((device) => device.plantId === id || device.id === plant?.deviceId ? { ...device, plantId: null } : device), watering: current.watering.filter((record) => record.plantId !== id), journal: current.journal.filter((entry) => entry.plantId !== id) }
  })

  const addReading = (plantId, changes = {}) => {
    setState((current) => ({
      ...current,
      plants: current.plants.map((plant) => {
        if (plant.id !== plantId) return plant
        const device = current.devices.find((item) => item.id === plant.deviceId)
        if (plant.deviceId && !device?.connected) return plant
        const previous = plant.current
        const next = {
          moisture: Math.max(0, Math.min(100, Math.round(changes.moisture ?? previous.moisture + Math.round((Math.random() * 6 - 3) * 10) / 10))),
          temperature: Math.round((changes.temperature ?? previous.temperature + (Math.random() - 0.5)) * 10) / 10,
          humidity: Math.max(15, Math.min(95, Math.round(changes.humidity ?? previous.humidity + (Math.random() * 4 - 2)))),
          light: Math.max(0, Math.round(changes.light ?? previous.light + (Math.random() * 140 - 70))),
          timestamp: new Date().toISOString(),
        }
        return { ...plant, current: next, readings: [...plant.readings, { id: createId(), ...next, event: changes.event ?? null }].slice(-300) }
      }),
    }))
  }

  const waterPlant = async (plantId, amount, mode = 'manual') => {
    const plant = state.plants.find((item) => item.id === plantId)
    if (!plant) throw new Error('식물을 찾을 수 없습니다.')
    if (pumpBusy) throw new Error('이미 급수 시뮬레이션이 진행 중입니다.')
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('급수량을 올바르게 설정해 주세요.')
    const device = state.devices.find((item) => item.id === plant.deviceId)
    if (!device?.connected) throw new Error('연결된 데모 기기가 없습니다. 기기를 먼저 연결해 주세요.')
    if (plant.current.moisture >= plant.moistureMax) throw new Error('토양 수분이 상한값에 도달해 급수를 중지했습니다.')
    if (amount > (plant.maxWaterAmount ?? 200)) throw new Error('1회 최대 급수량 설정을 초과합니다.')
    if (mode === 'auto' && (!plant.autoWatering || plant.current.moisture > plant.wateringThreshold)) throw new Error('자동 급수 모드 또는 급수 기준 조건을 충족하지 않습니다.')
    const mostRecent = state.watering.find((record) => record.plantId === plantId)
    const cooldownMs = (plant.cooldownMinutes ?? 60) * 60 * 1000
    if (mostRecent && Date.now() - new Date(mostRecent.timestamp).getTime() < cooldownMs) throw new Error('급수 후 대기시간이 지나지 않았습니다.')
    const todayTotal = state.watering.filter((record) => record.plantId === plantId && new Date(record.timestamp).toDateString() === new Date().toDateString()).reduce((sum, record) => sum + record.amount, 0)
    if (todayTotal + amount > (plant.maxDailyAmount ?? 500)) throw new Error('하루 최대 급수량 설정을 초과합니다.')

    setPumpBusy(true)
    setState((current) => ({ ...current, devices: current.devices.map((item) => item.id === plant.deviceId ? { ...item, pumpOn: true } : item) }))
    await new Promise((resolve) => setTimeout(resolve, 1900))
    const before = plant.current.moisture
    const after = Math.min(plant.moistureMax, Math.max(before + 7, Math.round(before + amount / 12)))
    const timestamp = new Date().toISOString()
    const record = { id: createId(), plantId, timestamp, before, after, amount, status: '완료', demo: true }
    setState((current) => ({
      ...current,
      plants: current.plants.map((item) => item.id === plantId ? { ...item, lastWatered: timestamp, current: { ...item.current, moisture: after, timestamp }, readings: [...item.readings, { id: createId(), timestamp, moisture: after, temperature: item.current.temperature, humidity: item.current.humidity, light: item.current.light, event: '급수' }] } : item),
      watering: [record, ...current.watering],
      devices: current.devices.map((item) => item.id === plant.deviceId ? { ...item, pumpOn: false, lastSeen: timestamp } : item),
      journal: [{ id: createId(), plantId, type: '급수', note: `급수 시뮬레이션 ${amount}ml · 급수 전 ${before}% → 안정화 확인값 ${after}%`, timestamp, waterRecordId: record.id }, ...current.journal],
    }))
    setPumpBusy(false)
    return record
  }

  const addAlert = (alert) => setState((current) => ({ ...current, alerts: [{ ...alert, id: createId(), timestamp: new Date().toISOString() }, ...current.alerts] }))
  const updateAlert = (id, status) => setState((current) => ({ ...current, alerts: current.alerts.map((alert) => alert.id === id ? { ...alert, status } : alert) }))
  const addJournal = (entry) => setState((current) => ({ ...current, journal: [{ ...entry, id: createId(), timestamp: new Date().toISOString() }, ...current.journal] }))
  const toggleDevice = (id) => setState((current) => ({ ...current, devices: current.devices.map((device) => device.id === id ? { ...device, connected: !device.connected, pumpOn: false, lastSeen: new Date().toISOString() } : device) }))
  const reset = () => setState(initialState())

  const alerts = useMemo(() => {
    const derived = deriveAlerts(state.plants, state.devices).map((alert) => {
      const override = state.alerts.find((item) => item.id === alert.id)
      return override ? { ...alert, status: override.status } : alert
    })
    const custom = state.alerts.filter((alert) => !alert.id.startsWith('rule-') && !derived.some((item) => item.type === alert.type && item.plantId === alert.plantId))
    return [...custom, ...derived]
  }, [state.alerts, state.devices, state.plants])

  const value = useMemo(() => ({ ...state, alerts, pumpBusy, addPlant, updatePlant, deletePlant, addReading, waterPlant, addAlert, updateAlert, addJournal, toggleDevice, reset }), [state, alerts, pumpBusy])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
