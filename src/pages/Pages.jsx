import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleAlert, Clock3, CloudSun, Droplets, Edit3, Flower2, Leaf, Lightbulb, Plus, RefreshCw, ShieldCheck, Sprout, Sun,
  Thermometer, Trash2, TriangleAlert, Wifi, WifiOff, Wind, X,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useApp } from '../context/AppContext'
import { getPlantStatus, predictWatering } from '../utils/analysis'
import {
  DemoTag, EmptyState, FormField, MetricCard, Modal, MoistureGauge, PageHeader, PlantImage, PrimaryButton, StatusPill,
} from '../components/UI'

const chartColors = { moisture: '#1B5E4B', temperature: '#D97706', humidity: '#5CBFA6', light: '#7C83E8' }
const dateLabel = (iso, options = { month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat('ko-KR', options).format(new Date(iso))
const timeLabel = (iso) => new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const relativeTime = (iso) => {
  if (!iso) return '기록 없음'
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  if (mins < 1440) return `${Math.floor(mins / 60)}시간 전`
  return `${Math.floor(mins / 1440)}일 전`
}
const chartDateLabel = (iso, period) => period === '24시간' ? timeLabel(iso) : dateLabel(iso)

function PlantSelect({ plants, selectedId, onChange }) {
  return <div className="select-wrap plant-select-wrap"><Sprout size={16} /><select value={selectedId} onChange={(event) => onChange(event.target.value)} aria-label="식물 선택">{plants.map((plant) => <option value={plant.id} key={plant.id}>{plant.name}</option>)}</select><ChevronDown size={15} /></div>
}

function PanelTitle({ title, subtitle, action }) {
  return <div className="panel-title-row"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
}

function PeriodTabs({ value, onChange }) {
  return <div className="period-tabs">{['24시간', '7일', '30일'].map((period) => <button key={period} className={value === period ? 'selected' : ''} onClick={() => onChange(period)}>{period}</button>)}</div>
}

function ChartTooltip({ active, payload, label, unit = '%' }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((item) => <div key={item.dataKey} style={{ color: item.color }}><span className="tooltip-dot" />{item.name}: {item.value}{unit}</div>)}</div>
}

function MoistureChart({ plant, period = '7일', height = 250, showWater = true }) {
  const hours = period === '24시간' ? 24 : period === '7일' ? 7 * 24 : 30 * 24
  const data = plant.readings.filter((reading) => Date.now() - new Date(reading.timestamp).getTime() <= hours * 3600000).map((reading) => ({
    ...reading, label: chartDateLabel(reading.timestamp, period),
  }))
  const sampled = data.length > 100 ? data.filter((_, index) => index % Math.ceil(data.length / 100) === 0 || index === data.length - 1) : data
  const event = sampled.find((item) => item.event === '급수')
  return <ResponsiveContainer width="100%" height={height}><ComposedChart data={sampled} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
    <defs><linearGradient id="moistureFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColors.moisture} stopOpacity={0.19} /><stop offset="95%" stopColor={chartColors.moisture} stopOpacity={0} /></linearGradient></defs>
    <CartesianGrid stroke="#EDF1ED" vertical={false} />
    <XAxis dataKey="label" tick={{ fill: '#8B9690', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={34} />
    <YAxis domain={[0, 100]} tick={{ fill: '#8B9690', fontSize: 11 }} axisLine={false} tickLine={false} ticks={[0, 25, 50, 75, 100]} />
    <Tooltip content={<ChartTooltip />} />
    <Area type="monotone" dataKey="moisture" name="토양 수분" stroke={chartColors.moisture} strokeWidth={2.5} fill="url(#moistureFill)" activeDot={{ r: 5 }} />
    {showWater && event && <ReferenceDot x={event.label} y={event.moisture} r={5} fill="#D97706" stroke="#fff" strokeWidth={2} label={{ value: '급수', position: 'top', fill: '#B45309', fontSize: 10 }} />}
  </ComposedChart></ResponsiveContainer>
}

function EnvironmentChart({ plant, period = '7일', height = 150, metric }) {
  const hours = period === '24시간' ? 24 : period === '7일' ? 7 * 24 : 30 * 24
  const readings = plant.readings.filter((item) => Date.now() - new Date(item.timestamp).getTime() <= hours * 3600000)
  const data = period === '24시간'
    ? readings.map((reading) => ({ ...reading, label: chartDateLabel(reading.timestamp, period) }))
    : Object.values(readings.reduce((groups, reading) => {
      const date = reading.timestamp.slice(0, 10)
      const group = groups[date] ?? { timestamp: `${date}T12:00:00.000Z`, label: chartDateLabel(`${date}T12:00:00.000Z`, period), temperature: 0, humidity: 0, light: 0, count: 0 }
      group.temperature += reading.temperature
      group.humidity += reading.humidity
      group.light += reading.light
      group.count += 1
      groups[date] = group
      return groups
    }, {})).map((group) => ({ ...group, [metric]: Math.round((group[metric] / group.count) * 10) / 10 }))
  const sampled = data.length > 100 ? data.filter((_, index) => index % Math.ceil(data.length / 100) === 0 || index === data.length - 1) : data
  const config = {
    temperature: { name: '온도', unit: '°C', color: chartColors.temperature },
    humidity: { name: '습도', unit: '%', color: chartColors.humidity },
    light: { name: '조도', unit: ' lux', color: chartColors.light },
  }[metric]
  return <ResponsiveContainer width="100%" height={height}><LineChart data={sampled} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
    <CartesianGrid stroke="#EDF1ED" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#8B9690', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={34} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#8B9690', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip unit={config.unit} />} /><Line type="monotone" dataKey={metric} name={config.name} stroke={config.color} dot={false} strokeWidth={2} activeDot={{ r: 4 }} />
  </LineChart></ResponsiveContainer>
}

function PlantCard({ plant }) {
  const status = getPlantStatus(plant)
  return <Link to={`/plants/${plant.id}`} className="plant-card">
    <PlantImage plant={plant} className="plant-card-image" />
    <div className="plant-card-body"><div className="plant-card-heading"><div><h3>{plant.name}</h3><span>{plant.species}</span></div><StatusPill status={status.label} tone={status.tone} /></div>
      <div className="plant-card-moisture"><div><Droplets size={15} /><span>토양 수분</span></div><strong>{plant.current.moisture}<small>%</small></strong></div>
      <div className="plant-card-track"><span style={{ width: `${plant.current.moisture}%` }} /></div>
      <div className="plant-card-footer"><span><Clock3 size={13} /> 최근 급수</span><strong>{plant.lastWatered ? relativeTime(plant.lastWatered) : '기록 없음'}</strong></div>
    </div><span className="plant-card-arrow"><ArrowRight size={17} /></span>
  </Link>
}

export function DashboardPage() {
  const { plants, watering, alerts, journal } = useApp()
  const healthy = plants.filter((plant) => getPlantStatus(plant).tone === 'healthy').length
  const needsCare = plants.length - healthy
  const nextWatering = plants.map((plant) => ({ plant, prediction: predictWatering(plant) })).filter(({ prediction }) => prediction.status === 'ready').sort((a, b) => a.prediction.days - b.prediction.days)[0]
  const latest = [...watering.map((item) => ({ ...item, type: '급수 완료', title: `${plants.find((plant) => plant.id === item.plantId)?.name ?? '식물'} 급수`, detail: `${item.before}% → ${item.after}% · ${item.amount}ml` })), ...journal.map((item) => ({ ...item, type: item.type, title: `${plants.find((plant) => plant.id === item.plantId)?.name ?? '식물'} ${item.type}`, detail: item.note }))].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 4)
  return <>
    <PageHeader eyebrow="목요일, 좋은 하루예요" title="안녕하세요, 김가드너님 👋" description="오늘도 식물들이 잘 자라고 있어요. 우리 집 가든의 상태를 확인해 보세요." action={<DemoTag />} />
    <div className="summary-grid">
      <div className="summary-card"><div className="summary-icon forest"><Sprout size={19} /></div><div><span>등록된 식물</span><strong>{plants.length}<small> 그루</small></strong></div><span className="summary-caption">내 가든의 식물</span></div>
      <div className="summary-card"><div className="summary-icon mint"><CheckCircle2 size={19} /></div><div><span>정상 관리 중</span><strong>{healthy}<small> 그루</small></strong></div><span className="summary-caption">{plants.length ? Math.round((healthy / plants.length) * 100) : 0}% 안정 상태</span></div>
      <div className="summary-card"><div className="summary-icon amber"><TriangleAlert size={19} /></div><div><span>관리 확인 필요</span><strong>{needsCare}<small> 그루</small></strong></div><span className="summary-caption">알림 {alerts.filter((item) => item.status === '주의' || item.status === '위험').length}건 확인</span></div>
      <div className="summary-card summary-next"><div className="summary-icon pale"><CalendarDays size={19} /></div><div><span>다음 급수 예상</span><strong className="next-value">{nextWatering ? nextWatering.prediction.days < 1 ? '오늘' : `${Math.ceil(nextWatering.prediction.days)}일 후` : '분석 중'}</strong></div><span className="summary-caption">{nextWatering?.plant.name ?? '측정 데이터 분석 중'}</span></div>
    </div>
    <section className="section-block"><div className="section-heading"><div><h2>나의 식물</h2><p>등록한 식물의 환경과 관리 상태를 한눈에 확인하세요.</p></div><Link className="text-link" to="/plants">모두 보기 <ArrowRight size={15} /></Link></div>
      {plants.length ? <div className="plant-grid">{plants.slice(0, 3).map((plant) => <PlantCard plant={plant} key={plant.id} />)}</div> : <EmptyState title="아직 등록된 식물이 없어요" description="첫 식물을 등록해 나만의 가든을 시작해 보세요." action={<Link className="primary-button" to="/plants"><Plus size={16} /> 식물 등록</Link>} />}
    </section>
    <div className="dashboard-lower">
      <section className="panel activity-panel"><PanelTitle title="최근 활동" subtitle="식물 관리의 최근 기록이에요." action={<Link to="/journal" className="panel-link">기록 보기 <ArrowRight size={14} /></Link>} />
        {latest.length ? <div className="activity-list">{latest.map((item) => <div className="activity-row" key={item.id}><div className={`activity-icon ${item.type === '급수' || item.type === '급수 완료' ? 'water' : 'note'}`}>{item.type.includes('급수') ? <Droplets size={16} /> : <Leaf size={16} />}</div><div className="activity-info"><strong>{item.title}</strong><span>{item.detail}</span></div><time>{relativeTime(item.timestamp)}</time></div>)}</div> : <div className="quiet-empty">아직 활동 기록이 없습니다.</div>}
      </section>
      <section className="panel insight-panel"><div className="insight-top"><div className="insight-icon"><Lightbulb size={18} /></div><span>오늘의 가든 인사이트</span></div><h3>{needsCare ? '확인이 필요한 식물이 있어요' : '가든이 편안한 상태예요'}</h3><p>{needsCare ? `${plants.filter((plant) => getPlantStatus(plant).tone !== 'healthy').map((plant) => plant.name).join(', ')}의 센서값을 확인하고 급수 예측을 살펴보세요.` : '모든 식물이 설정한 관리 기준 안에서 잘 지내고 있습니다.'}</p><Link to={needsCare ? '/alerts' : '/prediction'} className="insight-link">{needsCare ? '알림 확인하기' : '급수 예측 보기'} <ArrowRight size={15} /></Link><div className="insight-footnote">규칙 기반 데모 분석 · 식물 생육 진단이 아닙니다</div></section>
    </div>
    <div className="dashboard-note"><CircleAlert size={15} /><span>표시된 센서값과 예상 시점은 데모용 가상 데이터이며, 식물별 실제 권장 기준을 의미하지 않습니다.</span></div>
  </>
}

const blankPlantForm = { name: '', species: '', image: '', deviceId: '', moistureMin: 30, moistureMax: 65, temperatureMin: 18, temperatureMax: 29, wateringThreshold: 30 }

export function PlantsPage() {
  const { plants, devices, addPlant, updatePlant, deletePlant } = useApp()
  const [formPlant, setFormPlant] = useState(null)
  const [form, setForm] = useState(blankPlantForm)
  const [error, setError] = useState('')
  const openNew = () => { setError(''); setForm(blankPlantForm); setFormPlant('new') }
  const openEdit = (plant) => { setError(''); setForm({ ...plant }); setFormPlant(plant.id) }
  const save = (event) => {
    event.preventDefault()
    if (!form.name.trim() || !form.species.trim()) { setError('식물 이름과 종류를 입력해 주세요.'); return }
    if (Number(form.moistureMin) >= Number(form.moistureMax) || Number(form.wateringThreshold) > Number(form.moistureMax)) { setError('수분 하한값은 상한값보다 낮아야 하며, 급수 기준은 상한값 이하여야 합니다.'); return }
    const values = { ...form, name: form.name.trim(), species: form.species.trim(), moistureMin: Number(form.moistureMin), moistureMax: Number(form.moistureMax), temperatureMin: Number(form.temperatureMin), temperatureMax: Number(form.temperatureMax), wateringThreshold: Number(form.wateringThreshold), image: form.image.trim() || null }
    if (formPlant === 'new') addPlant(values)
    else updatePlant(formPlant, values)
    setFormPlant(null)
  }
  return <>
    <PageHeader eyebrow="MY GARDEN" title="내 식물" description="식물과 데모 기기, 관리 기준을 설정해 보세요." action={<PrimaryButton onClick={openNew}>식물 등록</PrimaryButton>} />
    <div className="notice-banner"><Lightbulb size={17} /><span>관리 기준은 사용자가 직접 설정하는 데모값입니다. 실제 식물별 권장값이나 생육 진단이 아닙니다.</span></div>
    {plants.length ? <div className="manage-plant-list">{plants.map((plant) => {
      const status = getPlantStatus(plant)
      const device = devices.find((item) => item.id === plant.deviceId)
      return <article className="manage-plant-card" key={plant.id}><PlantImage plant={plant} className="manage-plant-image" /><div className="manage-plant-info"><div className="manage-title"><div><h2>{plant.name}</h2><span>{plant.species}</span></div><StatusPill status={status.label} tone={status.tone} /></div><div className="manage-stats"><span><Droplets size={14} /> 수분 <b>{plant.current.moisture}%</b></span><span><Wifi size={14} /> {device?.name ?? '연결 기기 없음'}</span><span><Clock3 size={14} /> 측정 {relativeTime(plant.current.timestamp)}</span></div><div className="manage-threshold">데모 기준 · 수분 {plant.moistureMin}–{plant.moistureMax}% · 온도 {plant.temperatureMin}–{plant.temperatureMax}°C</div></div><div className="manage-actions"><Link className="secondary-button" to={`/plants/${plant.id}`}>상세 보기 <ArrowRight size={14} /></Link><button className="icon-btn" onClick={() => openEdit(plant)} title="식물 수정"><Edit3 size={16} /></button><button className="icon-btn danger-icon" onClick={() => window.confirm(`${plant.name}을(를) 삭제할까요?`) && deletePlant(plant.id)} title="식물 삭제"><Trash2 size={16} /></button></div></article>
    })}</div> : <EmptyState title="나의 가든을 시작해 보세요" description="식물 이름과 관리 기준을 입력해 첫 식물을 추가할 수 있어요." action={<PrimaryButton onClick={openNew}>식물 등록</PrimaryButton>} />}
    {formPlant && <Modal title={formPlant === 'new' ? '새 식물 등록' : '식물 정보 수정'} description="이미지 URL을 비워 두면 기본 일러스트가 표시됩니다." onClose={() => setFormPlant(null)}>
      <form className="modal-form" onSubmit={save}><div className="form-grid"><FormField label="식물 이름"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 몬스테라" /></FormField><FormField label="식물 종류"><input required value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} placeholder="예: 몬스테라 델리시오사" /></FormField></div><FormField label="식물 이미지 URL"><input value={form.image || ''} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://..." /></FormField>
        <FormField label="연결된 IoT 기기"><select value={form.deviceId || ''} onChange={(e) => setForm({ ...form, deviceId: e.target.value })}><option value="">기기 연결 안 함</option>{devices.filter((device) => !device.plantId || device.plantId === formPlant).map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></FormField>
        <div className="form-section-label">관리 기준 <small>모두 데모 설정값입니다</small></div>
        <div className="form-grid four"><FormField label="수분 하한 (%)"><input type="number" min="0" max="100" value={form.moistureMin} onChange={(e) => setForm({ ...form, moistureMin: e.target.value })} /></FormField><FormField label="수분 상한 (%)"><input type="number" min="0" max="100" value={form.moistureMax} onChange={(e) => setForm({ ...form, moistureMax: e.target.value })} /></FormField><FormField label="온도 하한 (°C)"><input type="number" value={form.temperatureMin} onChange={(e) => setForm({ ...form, temperatureMin: e.target.value })} /></FormField><FormField label="온도 상한 (°C)"><input type="number" value={form.temperatureMax} onChange={(e) => setForm({ ...form, temperatureMax: e.target.value })} /></FormField></div>
        <FormField label="급수 기준 수분값 (%)"><input type="number" min="0" max="100" value={form.wateringThreshold} onChange={(e) => setForm({ ...form, wateringThreshold: e.target.value })} hint="센서값이 이 기준 이하일 때 급수 예측·규칙 판정에 사용됩니다." /></FormField>
        {formPlant !== 'new' && <label className="checkbox-field"><input type="checkbox" checked={Boolean(form.autoWatering)} onChange={(e) => setForm({ ...form, autoWatering: e.target.checked })} /> 자동 급수 시뮬레이션 활성화</label>}
        {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormPlant(null)}>취소</button><button className="primary-button" type="submit"><Check size={16} /> 저장</button></div>
      </form>
    </Modal>}
  </>
}

export function MonitoringPage() {
  const { plants, devices, addReading } = useApp()
  const { plantId } = useParams()
  const navigate = useNavigate()
  const [period, setPeriod] = useState('7일')
  const plant = plants.find((item) => item.id === plantId) ?? plants[0]
  if (!plant) return <><PageHeader eyebrow="ENVIRONMENT" title="환경 모니터링" description="식물을 등록하면 센서 데이터를 확인할 수 있습니다." /><EmptyState title="등록된 식물이 없어요" description="내 식물 페이지에서 먼저 식물을 등록해 주세요." action={<Link className="primary-button" to="/plants">내 식물로 이동</Link>} /></>
  const status = getPlantStatus(plant)
  const device = devices.find((item) => item.id === plant.deviceId)
  return <>
    <PageHeader eyebrow="ENVIRONMENT MONITORING" title={plantId ? `${plant.name} 모니터링` : '환경 모니터링'} description="가상 센서값과 환경 변화를 확인하세요." action={<button className="secondary-button" disabled={Boolean(plant.deviceId && !device?.connected)} title={plant.deviceId && !device?.connected ? '기기가 연결되지 않았습니다.' : ''} onClick={() => addReading(plant.id)}><RefreshCw size={15} /> 새 측정값 생성</button>} />
    <div className="monitoring-toolbar"><PlantSelect plants={plants} selectedId={plant.id} onChange={(id) => navigate(`/plants/${id}`)} /><span className="last-updated"><span className={device?.connected || !plant.deviceId ? 'online-indicator' : 'offline-indicator'} />마지막 측정 {relativeTime(plant.current.timestamp)}</span><DemoTag /></div>
    <section className="plant-hero panel"><PlantImage plant={plant} className="detail-plant-image" /><div className="plant-hero-info"><div className="plant-hero-title"><div><div className="eyebrow">{plant.species}</div><h2>{plant.name}</h2></div><StatusPill status={device && !device.connected ? '기기 연결 끊김' : status.label} tone={device && !device.connected ? 'danger' : status.tone} /></div><div className="plant-hero-meta"><span><Clock3 size={14} /> 측정 {relativeTime(plant.current.timestamp)}</span><span><Droplets size={14} /> 마지막 급수 {plant.lastWatered ? dateLabel(plant.lastWatered) : '기록 없음'}</span><span><Wifi size={14} /> {device?.name ?? '연결 기기 없음'}</span></div></div><div className="next-watering-mini"><span>데모 예상 다음 급수</span><strong>{predictWatering(plant).status === 'ready' ? `약 ${Math.ceil(predictWatering(plant).days)}일 후` : '예측 데이터 부족'}</strong><Link to="/prediction">예측 자세히 <ArrowRight size={13} /></Link></div></section>
    <div className="sensor-grid"><div className="sensor-moisture panel"><div className="sensor-top"><div><span className="sensor-kicker">SOIL MOISTURE</span><h3>토양 수분</h3></div><span className="metric-small-icon water"><Droplets size={18} /></span></div><div className="gauge-row"><MoistureGauge value={plant.current.moisture} /><div className="gauge-meta"><span>데모 관리 범위</span><strong>{plant.moistureMin}% — {plant.moistureMax}%</strong><small>급수 기준 {plant.wateringThreshold}%</small><span className="gauge-caption">수치는 데모값입니다</span></div></div></div>
      <MetricCard icon={Thermometer} label="실내 온도" value={plant.current.temperature} unit="°C" hint={`설정 범위 ${plant.temperatureMin}–${plant.temperatureMax}°C`} tone="amber" />
      <MetricCard icon={Wind} label="공기 습도" value={plant.current.humidity} unit="%" hint="실내 상대 습도 · 데모값" tone="blue" />
      <MetricCard icon={Sun} label="조도" value={plant.current.light.toLocaleString()} unit="lux" hint="센서 측정 · 데모값" tone="violet" />
    </div>
    <section className="panel chart-panel"><PanelTitle title="환경 변화" subtitle="가상 센서 측정 데이터 · 급수 이벤트를 그래프에 표시합니다." action={<PeriodTabs value={period} onChange={setPeriod} />} /><div className="chart-legend"><span><i style={{ background: chartColors.moisture }} />토양 수분 (%)</span><span><i style={{ background: chartColors.temperature }} />온도 (°C)</span><span><i style={{ background: chartColors.humidity }} />습도 (%)</span><span><i style={{ background: chartColors.light }} />조도 (lux)</span><span className="legend-water"><i />급수</span></div><MoistureChart plant={plant} period={period} height={260} /><div className="chart-footnote"><span><Activity size={13} /> {period} 측정 데이터</span><span>새 측정값 생성 시 그래프와 현재 값이 함께 갱신됩니다.</span></div></section>
    <section className="panel environment-charts"><PanelTitle title="온도 · 습도 · 조도 추이" subtitle={`${period} 기준 가상 환경 센서 데이터`} /><div className="environment-chart-grid">{[['temperature', '실내 온도', '°C'], ['humidity', '공기 습도', '%'], ['light', '조도', 'lux']].map(([metric, label, unit]) => <article className="environment-chart-card" key={metric}><div><strong>{label}</strong><span>{metric === 'temperature' ? plant.current.temperature : metric === 'humidity' ? plant.current.humidity : plant.current.light.toLocaleString()} {unit}</span></div><EnvironmentChart plant={plant} period={period} metric={metric} /></article>)}</div></section>
    <div className="monitor-bottom-grid"><section className="panel"><PanelTitle title="최근 측정 기록" subtitle="최신 가상 센서 측정값" /><div className="reading-table"><div className="reading-head"><span>측정 시간</span><span>수분</span><span>온도</span><span>습도</span><span>조도</span></div>{plant.readings.slice(-5).reverse().map((reading) => <div className="reading-row" key={reading.id}><span>{dateLabel(reading.timestamp, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span><strong>{reading.moisture}% {reading.event && <em>급수</em>}</strong><span>{reading.temperature}°</span><span>{reading.humidity}%</span><span>{reading.light} lux</span></div>)}</div></section><section className="panel"><PanelTitle title="관리 기준" subtitle="사용자가 설정한 데모 기준" /><div className="threshold-list"><div><span>토양 수분</span><strong>{plant.moistureMin}–{plant.moistureMax}%</strong></div><div><span>온도 범위</span><strong>{plant.temperatureMin}–{plant.temperatureMax}°C</strong></div><div><span>급수 기준</span><strong>{plant.wateringThreshold}%</strong></div></div><Link to="/plants" className="panel-link edit-threshold-link"><Edit3 size={14} /> 기준값 수정</Link></section></div>
  </>
}

export function PredictionPage() {
  const { plants } = useApp()
  const [plantId, setPlantId] = useState(plants[0]?.id ?? '')
  const [period, setPeriod] = useState('7일')
  const plant = plants.find((item) => item.id === plantId)
  if (!plant) return <><PageHeader eyebrow="WATERING FORECAST" title="급수 예측" description="데이터 기반 데모 예측 결과를 확인하세요." /><EmptyState title="분석할 식물이 없어요" description="식물을 등록하면 센서 추세를 분석할 수 있습니다." action={<Link to="/plants" className="primary-button">식물 등록</Link>} /></>
  const prediction = predictWatering(plant)
  return <>
    <PageHeader eyebrow="WATERING FORECAST" title="급수 시점 예측" description="최근 토양 수분의 변화 추세로 기준값 도달 시점을 추정합니다." action={<PlantSelect plants={plants} selectedId={plant.id} onChange={setPlantId} />} />
    <div className="forecast-disclaimer"><Lightbulb size={18} /><div><strong>데모 예측 · 센서 추세 계산</strong><p>실제 식물의 생육 상태를 진단하지 않으며, 설정된 센서 기준값에 도달하는 시점만 추정합니다.</p></div></div>
    <div className="forecast-hero-grid"><section className="forecast-result panel"><div className="forecast-result-head"><span className="forecast-icon"><CalendarDays size={20} /></span><span>예상 급수 시점</span><span className="forecast-demo-label">시뮬레이션</span></div>{prediction.status === 'ready' ? <><div className="forecast-big">{prediction.days < 1 ? '기준 도달' : `약 ${Math.ceil(prediction.days)}일 후`}</div><p>{prediction.days < 1 ? '현재 센서 수분값이 설정한 급수 기준에 도달했습니다.' : `${dateLabel(new Date(Date.now() + prediction.days * 86400000).toISOString())} 전후로 설정한 기준에 도달할 수 있어요.`}</p></> : <><div className="forecast-big muted">{prediction.status === 'uncertain' ? '예측 불확실' : '예측 데이터 부족'}</div><p>{prediction.reason}</p></>}<div className="forecast-result-foot"><span><Clock3 size={14} /> 분석 기간 {prediction.period ?? '측정 데이터 확보 중'}</span><span>센서값 {plant.current.moisture}% · 기준 {plant.wateringThreshold}%</span></div></section>
      <div className="forecast-stat-stack"><div className="forecast-stat panel"><div className="forecast-stat-icon"><Droplets size={18} /></div><span>현재 토양 수분</span><strong>{plant.current.moisture}<small>%</small></strong><div className="forecast-stat-foot">급수 기준 {plant.wateringThreshold}%</div></div><div className="forecast-stat panel"><div className="forecast-stat-icon amber"><ArrowDownRight size={18} /></div><span>평균 감소 속도</span><strong>{prediction.status === 'ready' ? prediction.rate.toFixed(1) : '—'}<small>%p/일</small></strong><div className="forecast-stat-foot">이동평균 기반 추세</div></div></div></div>
    <section className="panel chart-panel prediction-chart-panel"><PanelTitle title={`${plant.name} 토양 수분 변화`} subtitle={`최근 ${period} 가상 측정값 · 급수 이벤트 표시`} action={<PeriodTabs value={period} onChange={setPeriod} />} /><div className="chart-legend"><span><i style={{ background: chartColors.moisture }} />토양 수분</span><span className="legend-water"><i />급수 시점</span></div><MoistureChart plant={plant} period={period} height={280} /><div className="prediction-threshold"><span>설정 급수 기준</span><strong>{plant.wateringThreshold}%</strong></div></section>
    <section className="panel analysis-panel"><PanelTitle title="예측 근거" subtitle="간단한 규칙 기반 분석 · 머신러닝/AI 미사용" /><div className="analysis-steps"><div className="analysis-step"><span>01</span><div><strong>측정 데이터 기간</strong><p>최근 14일 동안 기록된 측정값 {plant.readings.slice(-14).length}개를 사용했습니다.</p></div></div><div className="analysis-step"><span>02</span><div><strong>일시적 변동 완화</strong><p>최근 3회 측정값의 이동평균으로 센서값의 일시적인 흔들림을 완화했습니다.</p></div></div><div className="analysis-step"><span>03</span><div><strong>선형 감소 추세와 기준 도달 계산</strong><p>{prediction.status === 'ready' ? `평균 ${prediction.rate.toFixed(1)}%p/일 감소 추세가 유지된다고 가정해 ${plant.wateringThreshold}% 도달 시점을 계산했습니다.` : prediction.reason}</p></div></div></div></section>
  </>
}

export function WateringPage() {
  const { plants, devices, watering, pumpBusy, updatePlant, waterPlant } = useApp()
  const [plantId, setPlantId] = useState(plants[0]?.id ?? '')
  const [confirm, setConfirm] = useState(false)
  const [amount, setAmount] = useState(120)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [wateringMode, setWateringMode] = useState('manual')
  const plant = plants.find((item) => item.id === plantId)
  if (!plant) return <><PageHeader eyebrow="DEMO IRRIGATION" title="자동 급수" description="가상 워터펌프와 급수 시뮬레이션을 체험하세요." /><EmptyState title="급수할 식물이 없어요" description="먼저 식물을 등록해 주세요." action={<Link to="/plants" className="primary-button">식물 등록</Link>} /></>
  const device = devices.find((item) => item.id === plant.deviceId)
  const records = watering.filter((record) => record.plantId === plant.id)
  const todayTotal = records.filter((record) => new Date(record.timestamp).toDateString() === new Date().toDateString()).reduce((sum, record) => sum + record.amount, 0)
  const settings = { threshold: plant.wateringThreshold, one: plant.maxWaterAmount ?? 200, daily: plant.maxDailyAmount ?? 500, cooldown: plant.cooldownMinutes ?? 60 }
  const cooldownActive = Boolean(records[0] && Date.now() - new Date(records[0].timestamp).getTime() < settings.cooldown * 60000)
  const setSetting = (key, value) => updatePlant(plant.id, { [key]: Number(value) })
  const startWatering = async () => {
    setError(''); setMessage('')
    try { await waterPlant(plant.id, Number(amount), wateringMode); setConfirm(false); setMessage('급수 시뮬레이션이 완료되었습니다. 안정화 확인값이 센서 기록에 반영되었습니다.') } catch (issue) { setError(issue.message) }
  }
  const autoAmount = Math.min(settings.one, 120)
  const autoCondition = plant.current.moisture <= settings.threshold && plant.current.moisture < plant.moistureMax && device?.connected && !pumpBusy && !cooldownActive && todayTotal + autoAmount <= settings.daily && settings.one > 0
  return <>
    <PageHeader eyebrow="DEMO IRRIGATION" title="자동 급수 관리" description="워터펌프 동작과 급수 후 센서값 안정화 과정을 시뮬레이션합니다." action={<DemoTag children="하드웨어 연결 없음" />} />
    <div className="watering-toolbar"><PlantSelect plants={plants} selectedId={plant.id} onChange={setPlantId} /><div className={`pump-state ${pumpBusy ? 'pump-active' : ''}`}><span className="pump-light" />{pumpBusy ? '펌프 시뮬레이션 중' : '워터펌프 대기'}</div></div>
    {message && <div className="success-banner"><CheckCircle2 size={17} />{message}<button onClick={() => setMessage('')} aria-label="닫기"><X size={15} /></button></div>}
    {error && <div className="error-banner"><CircleAlert size={17} />{error}<button onClick={() => setError('')} aria-label="닫기"><X size={15} /></button></div>}
    <div className="watering-main-grid"><section className={`pump-card ${pumpBusy ? 'active' : ''}`}><div className="pump-card-top"><div className="pump-card-symbol"><Droplets size={25} /></div><span className="pump-demo-pill">DEMO PUMP</span></div><div className="water-drops"><span /><span /><span /></div><h2>{pumpBusy ? '가상 급수 진행 중' : '시뮬레이션 준비 완료'}</h2><p>{pumpBusy ? '급수 완료 후 센서값 안정화를 확인하고 있어요.' : '실제 펌프는 연결되지 않았습니다. 버튼으로 시뮬레이션할 수 있어요.'}</p><div className="tank-wrap"><div className="tank-label"><span>가상 물탱크</span><strong>78%</strong></div><div className="tank-track"><span style={{ width: '78%' }} /></div><small>데모 수위 · 실제 물탱크 없음</small></div><button className="pump-start-button" disabled={pumpBusy || !device?.connected} onClick={() => { setError(''); setWateringMode('manual'); setAmount(Math.min(120, settings.one)); setConfirm(true) }}><Droplets size={17} />{pumpBusy ? '급수 중...' : '수동 급수 시뮬레이션'}</button>{!device?.connected && <div className="pump-warning">기기가 연결되지 않아 시뮬레이션할 수 없습니다.</div>}</section>
      <section className="panel watering-control-panel"><PanelTitle title="급수 설정" subtitle="식물별로 저장되는 데모 안전 설정" /><div className="auto-toggle-row"><div><strong>자동 급수 모드</strong><span>조건 확인 버튼을 눌렀을 때만 시뮬레이션됩니다.</span></div><button className={`toggle ${plant.autoWatering ? 'on' : ''}`} onClick={() => updatePlant(plant.id, { autoWatering: !plant.autoWatering })} aria-pressed={Boolean(plant.autoWatering)}><span /></button></div><div className="setting-sliders"><label><span>급수 기준 수분값 <strong>{settings.threshold}%</strong></span><input type="range" min="10" max="60" value={settings.threshold} onChange={(e) => { setSetting('wateringThreshold', e.target.value); setSetting('moistureMin', e.target.value) }} /></label><label><span>1회 최대 급수량 <strong>{settings.one}ml</strong></span><input type="range" min="30" max="300" step="10" value={settings.one} onChange={(e) => setSetting('maxWaterAmount', e.target.value)} /></label><label><span>하루 최대 급수량 <strong>{settings.daily}ml</strong></span><input type="range" min="100" max="1000" step="50" value={settings.daily} onChange={(e) => setSetting('maxDailyAmount', e.target.value)} /></label><label><span>급수 후 대기시간 <strong>{settings.cooldown}분</strong></span><input type="range" min="15" max="240" step="15" value={settings.cooldown} onChange={(e) => setSetting('cooldownMinutes', e.target.value)} /></label>            </div><div className="daily-usage"><div><span>오늘 사용량</span><strong>{todayTotal} <small>/ {settings.daily}ml</small></strong></div><div className="daily-progress"><span style={{ width: `${Math.min(100, todayTotal / settings.daily * 100)}%` }} /></div></div>{plant.autoWatering && <button className={`auto-run-button ${autoCondition ? 'ready' : ''}`} disabled={!autoCondition} onClick={() => { setAmount(autoAmount); setWateringMode('auto'); setConfirm(true) }}><RefreshCw size={15} />{autoCondition ? '조건 충족 · 자동 급수 시뮬레이션' : cooldownActive ? '급수 후 대기시간 적용 중' : '자동 급수 대기 · 조건 미충족'}</button>}<div className="safety-footnote"><ShieldCheck size={15} /><span>연결 상태 · 상한값 · 1회/일일 최대량을 확인합니다. 대기시간 설정은 데모 표시이며, 실제 펌프 제어가 아닙니다.</span></div></section></div>
    <section className="panel watering-history"><PanelTitle title="급수 이력" subtitle={`${plant.name}의 급수 전후 센서 확인값 · 모두 시뮬레이션 데이터`} action={<Link to="/journal" className="panel-link">관리 히스토리 <ArrowRight size={14} /></Link>} />
      {records.length ? <div className="watering-record-list">{records.map((record) => <div className="watering-record" key={record.id}><div className="record-icon"><Droplets size={17} /></div><div className="record-date"><strong>{dateLabel(record.timestamp, { year: 'numeric', month: 'short', day: 'numeric' })}</strong><span>{timeLabel(record.timestamp)}</span></div><div className="record-comparison"><div><span>급수 전</span><strong>{record.before}%</strong></div><ArrowRight size={16} /><div className="after-reading"><span>안정화 확인값</span><strong>{record.after}%</strong></div></div><div className="record-amount">{record.amount}ml <StatusPill status="완료" /></div></div>)}</div> : <div className="quiet-empty">아직 급수 기록이 없습니다.</div>}
    </section>
    {confirm && <Modal title="급수 시뮬레이션 확인" description={`${plant.name}에 가상 급수를 진행합니다. 실제 하드웨어를 제어하지 않습니다.`} onClose={() => setConfirm(false)}><div className="water-confirm-summary"><div className="confirm-current"><span>현재 토양 수분</span><strong>{plant.current.moisture}%</strong></div><ArrowRight size={18} /><div className="confirm-current expected"><span>예상 안정화 확인값</span><strong>{Math.min(plant.moistureMax, Math.max(plant.current.moisture + 7, Math.round(plant.current.moisture + Number(amount) / 12)))}%</strong></div></div><FormField label="예상 급수량"><select value={amount} onChange={(e) => setAmount(e.target.value)}>{[60, 90, 120, 150, 180, 200].filter((value) => value <= settings.one).map((value) => <option key={value} value={value}>{value}ml</option>)}</select></FormField><div className="demo-explainer"><CircleAlert size={16} />시뮬레이션 후 가상의 센서 안정화 확인값과 관리 기록이 업데이트됩니다. 즉시 정상 범위가 된다고 가정하지 않습니다.</div><div className="modal-actions"><button className="secondary-button" onClick={() => setConfirm(false)}>취소</button><button className="primary-button" onClick={startWatering}><Droplets size={16} />시뮬레이션 승인</button></div></Modal>}
  </>
}

export function AlertsPage() {
  const { plants, alerts, addAlert, addReading, updateAlert } = useApp()
  const [plantId, setPlantId] = useState(plants[0]?.id ?? '')
  const [scenarioMessage, setScenarioMessage] = useState('')
  const selected = plants.find((item) => item.id === plantId)
  const scenarios = [
    { label: '수분 부족', run: () => { if (!selected) return; addReading(selected.id, { moisture: Math.max(0, selected.wateringThreshold - 4), event: '시나리오' }); setScenarioMessage('수분 부족 시나리오 측정값을 생성했습니다.') } },
    { label: '급수 실패 의심', run: () => { if (!selected) return; addAlert({ plantId: selected.id, type: '급수 결과 확인 필요', level: '주의', status: '주의', message: '급수 시뮬레이션 후 확인 시간이 지났지만 수분값이 증가하지 않은 상황을 가정합니다. 펌프 또는 센서 상태를 확인하세요.' }); setScenarioMessage('급수 실패 의심 알림을 추가했습니다.') } },
    { label: '센서 이상', run: () => { if (!selected) return; addAlert({ plantId: selected.id, type: '센서 상태 점검', level: '위험', status: '위험', message: '비정상 측정값 반복 상황을 가정합니다. 기기 연결과 센서 상태를 점검하세요.' }); setScenarioMessage('센서 이상 시나리오 알림을 추가했습니다.') } },
    { label: '과습 위험', run: () => { if (!selected) return; addReading(selected.id, { moisture: Math.min(100, selected.moistureMax + 8), event: '시나리오' }); setScenarioMessage('과습 시나리오 측정값을 생성했습니다. 자동 급수는 상한 조건에서 차단됩니다.') } },
  ]
  const plantName = (id) => plants.find((plant) => plant.id === id)?.name ?? '삭제된 식물'
  return <>
    <PageHeader eyebrow="RULE-BASED MONITORING" title="이상 감지 · 알림" description="가상 센서값과 급수 결과를 규칙 기반으로 확인합니다." action={<PlantSelect plants={plants} selectedId={plantId} onChange={setPlantId} />} />
    <div className="notice-banner"><TriangleAlert size={17} /><span>규칙 기반 데모 알림입니다. 진단 결과가 아니며, 모든 시나리오는 가상 데이터로 동작합니다.</span></div>
    <section className="panel scenario-panel"><PanelTitle title="이상 상황 시뮬레이션" subtitle="버튼을 눌러 상황별 알림을 생성해 보세요." /><div className="scenario-actions">{scenarios.map((scenario) => <button className="scenario-button" onClick={scenario.run} key={scenario.label}><Plus size={14} />{scenario.label}</button>)}</div>{scenarioMessage && <div className="scenario-message"><CheckCircle2 size={15} />{scenarioMessage}</div>}</section>
    <div className="alert-count-row"><div><strong>{alerts.filter((item) => item.status === '주의' || item.status === '위험').length}</strong><span>확인 필요</span></div><div><strong>{alerts.filter((item) => item.status === '해결 완료' || item.status === '확인').length}</strong><span>확인·해결 완료</span></div><div><strong>{alerts.length}</strong><span>전체 알림</span></div></div>
    <section className="panel alert-list-panel"><PanelTitle title="알림 목록" subtitle="상태를 확인하거나 해결 완료로 변경할 수 있습니다." />
      {alerts.length ? <div className="alert-list">{alerts.map((alert) => <article className={`alert-row ${alert.status === '해결 완료' ? 'resolved' : ''}`} key={alert.id}><div className={`alert-type-icon ${alert.level === '위험' ? 'danger' : alert.level === '정상' ? 'ok' : 'warning'}`}>{alert.level === '위험' ? <CircleAlert size={18} /> : alert.level === '정상' ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}</div><div className="alert-content"><div className="alert-title-row"><strong>{alert.type}</strong><StatusPill status={alert.status} tone={alert.status === '해결 완료' || alert.status === '확인' ? 'healthy' : alert.level === '위험' ? 'danger' : 'warning'} /><span className="alert-plant">{plantName(alert.plantId)}</span></div><p>{alert.message}</p><time>{dateLabel(alert.timestamp, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {relativeTime(alert.timestamp)}</time></div><div className="alert-actions">{alert.status !== '확인' && alert.status !== '해결 완료' && <button className="secondary-button small" onClick={() => updateAlert(alert.id, '확인')}>확인</button>}{alert.status !== '해결 완료' && <button className="resolve-button" onClick={() => updateAlert(alert.id, '해결 완료')}><Check size={14} />해결 완료</button>}</div></article>)}</div> : <EmptyState title="현재 알림이 없습니다" description="센서값이 관리 기준을 벗어나거나 시나리오를 실행하면 여기에 표시됩니다." />}</section>
    <div className="alert-rule-note"><ShieldCheck size={16} /><span>감지 규칙: 급수 기준 이하 수분 · 상한 초과 과습 · 기기 연결 해제 · 24시간 이상 측정 지연</span></div>
  </>
}

export function JournalPage() {
  const { plants, journal, watering, addJournal } = useApp()
  const [plantId, setPlantId] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState('')
  const [error, setError] = useState('')
  const entries = [...journal.map((entry) => ({ ...entry, recordType: 'journal' })), ...watering.map((record) => ({ ...record, type: '급수', note: `급수 전 ${record.before}% → 안정화 확인값 ${record.after}% · ${record.amount}ml`, recordType: 'watering' }))].filter((entry) => plantId === 'all' || entry.plantId === plantId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const handlePhoto = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 등록할 수 있습니다.'); return }
    if (file.size > 2 * 1024 * 1024) { setError('이미지는 2MB 이하 파일을 선택해 주세요.'); return }
    const reader = new FileReader()
    reader.onload = () => setPhoto(String(reader.result))
    reader.onerror = () => setError('이미지 파일을 읽지 못했습니다.')
    reader.readAsDataURL(file)
  }
  const save = (event) => {
    event.preventDefault()
    if (!note.trim()) { setError('메모를 입력해 주세요.'); return }
    addJournal({ plantId: plantId === 'all' ? plants[0]?.id : plantId, type: '성장 일지', note: note.trim(), image: photo })
    setNote(''); setPhoto(''); setError(''); setFormOpen(false)
  }
  return <>
    <PageHeader eyebrow="GARDEN JOURNAL" title="성장 기록" description="식물의 변화와 관리 과정을 기록하고 급수 결과를 비교하세요." action={<PrimaryButton onClick={() => { setError(''); setFormOpen(true) }}>일지 작성</PrimaryButton>} />
    <div className="journal-toolbar"><div className="journal-filter"><span>식물 필터</span><PlantSelect plants={plants} selectedId={plantId} onChange={setPlantId} /></div><DemoTag /></div>
    {entries.length ? <div className="timeline">{entries.map((entry) => <article className="timeline-entry" key={`${entry.recordType}-${entry.id}`}><div className={`timeline-marker ${entry.recordType === 'watering' || entry.type === '급수' ? 'water' : ''}`}>{entry.recordType === 'watering' || entry.type === '급수' ? <Droplets size={15} /> : <Leaf size={15} />}</div><div className="timeline-card panel"><div className="timeline-head"><div><span className="timeline-type">{entry.type}</span><h3>{plantNameFor(plants, entry.plantId)}</h3></div><time>{dateLabel(entry.timestamp, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div>{entry.note && <p>{entry.note}</p>}{entry.image && <img className="journal-photo" src={entry.image} alt="성장 기록 사진" />}{entry.recordType === 'watering' && <div className="before-after"><div><span>급수 전</span><strong>{entry.before}%</strong></div><div className="comparison-arrow"><ArrowRight size={17} /></div><div className="after-reading"><span>안정화 확인값</span><strong>{entry.after}%</strong></div><span className="comparison-caption">가상 센서값 · 급수 효과 시뮬레이션</span></div>}</div></article>)}</div> : <EmptyState title="아직 기록이 없습니다" description="첫 성장 일지를 작성하거나 급수 시뮬레이션을 실행해 관리 기록을 남겨 보세요." action={<PrimaryButton onClick={() => setFormOpen(true)}>일지 작성</PrimaryButton>} />}
    {formOpen && <Modal title="성장 일지 작성" description="메모와 선택 사진은 이 브라우저에 데모 데이터로 저장됩니다." onClose={() => setFormOpen(false)}><form className="modal-form" onSubmit={save}><FormField label="기록할 식물"><select value={plantId === 'all' ? plants[0]?.id ?? '' : plantId} onChange={(e) => setPlantId(e.target.value)}>{plants.map((plant) => <option value={plant.id} key={plant.id}>{plant.name}</option>)}</select></FormField><FormField label="메모"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows="4" placeholder="식물의 성장이나 관리 내용을 기록해 보세요." /></FormField><FormField label="사진 (선택)"><input type="file" accept="image/*" onChange={(e) => handlePhoto(e.target.files?.[0])} /></FormField>{photo && <img className="journal-preview" src={photo} alt="사진 미리보기" />}{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>취소</button><button className="primary-button" type="submit"><Check size={16} />기록 저장</button></div></form></Modal>}
  </>
}
function plantNameFor(plants, id) { return plants.find((plant) => plant.id === id)?.name ?? '삭제된 식물' }

export function DevicesPage() {
  const { devices, plants, toggleDevice, addReading } = useApp()
  const { alerts } = useApp()
  return <>
    <PageHeader eyebrow="DEVICE MANAGEMENT" title="IoT 기기 관리" description="ESP32 연동을 대비한 가상 기기 상태 화면입니다." action={<DemoTag children="가상 연결 상태" />} />
    <div className="device-architecture"><div className="architecture-node"><span className="architecture-icon"><Wifi size={18} /></span><strong>ESP32 · 센서</strong><small>하드웨어 미연결</small></div><ArrowRight size={18} /><div className="architecture-node"><span className="architecture-icon server"><Activity size={18} /></span><strong>Spring Boot API</strong><small>연동 예정</small></div><ArrowRight size={18} /><div className="architecture-node"><span className="architecture-icon app"><Leaf size={18} /></span><strong>PlantPilot 웹</strong><small>Mock Data 데모</small></div></div>
    <div className="device-heading"><div><h2>등록된 기기</h2><p>연결 전환은 화면 내 가상 상태만 변경합니다.</p></div><span className="device-summary"><span className="online-indicator" />{devices.filter((device) => device.connected).length} / {devices.length} 연결됨</span></div>
    {devices.length ? <div className="device-list">{devices.map((device) => { const plant = plants.find((item) => item.id === device.plantId); return <article className="device-card panel" key={device.id}><div className="device-card-top"><div className={`device-avatar ${device.connected ? '' : 'disconnected'}`}><Wifi size={22} /></div><div className="device-title"><h3>{device.name}</h3><span>{device.model}</span></div><StatusPill status={device.connected ? '연결됨' : '연결 끊김'} tone={device.connected ? 'healthy' : 'warning'} /></div><div className="device-detail-grid"><div><span>연결 식물</span><strong>{plant?.name ?? '연결된 식물 없음'}</strong></div><div><span>마지막 통신</span><strong>{relativeTime(device.lastSeen)}</strong></div><div><span>워터펌프</span><strong>{device.pumpOn ? '작동 시뮬레이션 중' : '대기'}</strong></div></div><div className="sensor-health"><span><i className={device.connected ? 'sensor-ok' : 'sensor-down'} />토양 수분</span><span><i className={device.connected ? 'sensor-ok' : 'sensor-down'} />온습도</span><span><i className={device.connected ? 'sensor-ok' : 'sensor-down'} />조도</span><span><i className={device.connected ? 'sensor-ok' : 'sensor-down'} />워터펌프</span></div><div className="device-card-actions"><button className={device.connected ? 'secondary-button' : 'primary-button'} onClick={() => toggleDevice(device.id)}>{device.connected ? <><WifiOff size={15} />가상 연결 해제</> : <><Wifi size={15} />가상 재연결</>}</button>{plant && <button className="secondary-button" disabled={!device.connected} onClick={() => addReading(plant.id)}><RefreshCw size={15} />센서 테스트</button>}</div></article>})}</div> : <EmptyState title="등록된 기기가 없습니다" description="내 식물 관리에서 가상 기기를 연결할 수 있습니다." action={<Link to="/plants" className="primary-button">내 식물 관리</Link>} />}
    <div className="device-integration-note"><ShieldCheck size={17} /><div><strong>향후 연동 구조</strong><p>ESP32 센서 → Spring Boot API → 센서 저장·분석 → React 대시보드. 현재 UI와 상태는 브라우저 내 데모 데이터로 동작하며, 실제 Wi-Fi/Bluetooth 통신은 구현되어 있지 않습니다.</p></div></div>
  </>
}

export function NotFoundPage() {
  return <div className="not-found"><Sprout size={28} /><h1>페이지를 찾을 수 없어요</h1><p>요청하신 주소가 올바른지 확인해 주세요.</p><Link className="primary-button" to="/">대시보드로 이동</Link></div>
}
