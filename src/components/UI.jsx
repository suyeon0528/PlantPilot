import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, ChevronDown, CircleHelp, Droplets, Leaf, Menu, Plus, RotateCcw, Sprout, X } from 'lucide-react'
import { useApp } from '../context/AppContext'

export const navItems = [
  { to: '/', label: '대시보드', icon: Sprout },
  { to: '/plants', label: '내 식물', icon: Leaf },
  { to: '/monitoring', label: '환경 모니터링', icon: Droplets },
  { to: '/prediction', label: '급수 예측', icon: ArrowDownRight },
  { to: '/watering', label: '자동 급수', icon: Droplets },
  { to: '/alerts', label: '이상 감지 · 알림', icon: AlertTriangle },
  { to: '/journal', label: '성장 기록', icon: Check },
  { to: '/devices', label: 'IoT 기기 관리', icon: CircleHelp },
]

export function Sidebar({ onClose }) {
  const { reset } = useApp()
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark"><Leaf size={21} strokeWidth={2.2} /></div>
        <span className="brand-name">PlantPilot</span>
        <button className="icon-btn mobile-close" onClick={onClose} aria-label="메뉴 닫기"><X size={19} /></button>
      </div>
      <div className="workspace-label">WORKSPACE</div>
      <div className="workspace-switch"><span className="workspace-avatar">H</span><span>홈 가든</span><ChevronDown size={15} className="muted-icon" /></div>
      <nav className="side-nav">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="demo-card"><div className="demo-icon"><span className="live-dot" /> DEMO MODE</div><p>현재 모든 센서 데이터와 기기 제어는 시뮬레이션입니다.</p></div>
        <button className="reset-button" onClick={() => { if (window.confirm('모든 변경 내용을 지우고 데모 데이터를 초기화할까요?')) reset() }}>
          <RotateCcw size={15} /> 데모 데이터 초기화
        </button>
        <div className="user-profile"><div className="user-avatar">김</div><div className="user-meta"><strong>김가드너</strong><span>무료 데모 계정</span></div><ChevronDown size={15} className="muted-icon" /></div>
      </div>
    </aside>
  )
}

export function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action && <div className="header-action">{action}</div>}</div>
}

export function DemoTag({ children = '데모 시뮬레이션' }) {
  return <span className="demo-tag"><span className="live-dot" />{children}</span>
}

export function StatusPill({ status, tone }) {
  const palette = tone || (status === '정상' || status === '정상 관리 중' || status === '해결 완료' ? 'healthy' : status === '위험' || status === '과습 위험' ? 'danger' : 'warning')
  return <span className={`status-pill ${palette}`}><span className="status-dot" />{status}</span>
}

export function PlantImage({ plant, className = '' }) {
  const [failed, setFailed] = useState(false)
  return <div className={`plant-image ${className}`}>{plant.image && !failed ? <img src={plant.image} alt={`${plant.name} 사진`} onError={() => setFailed(true)} /> : <div className="image-fallback"><Leaf size={29} /></div>}</div>
}

export function MoistureGauge({ value, size = 'normal' }) {
  const clamped = Math.max(0, Math.min(100, value))
  const color = clamped < 25 ? '#D97706' : clamped > 75 ? '#DC2626' : '#1B5E4B'
  return <div className={`moisture-gauge ${size}`} style={{ '--gauge-value': `${clamped}%`, '--gauge-color': color }}><div className="gauge-inner"><span className="gauge-number">{value}<small>%</small></span><span className="gauge-label">토양 수분</span></div></div>
}

export function MetricCard({ icon: Icon, label, value, unit, hint, tone = 'green', change }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19} /></div><div className="metric-main"><span className="metric-label">{label}</span><div className="metric-value">{value}<small>{unit}</small></div>{hint && <div className="metric-hint">{change && (change > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />)}{hint}</div>}</div></div>
}

export function EmptyState({ title, description, action }) {
  return <div className="empty-state"><div className="empty-icon"><Sprout size={24} /></div><h3>{title}</h3><p>{description}</p>{action}</div>
}

export function Modal({ title, description, children, onClose }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-btn" onClick={onClose} aria-label="닫기"><X size={19} /></button></div>{children}</section></div>
}

export function FormField({ label, children, hint }) {
  return <label className="form-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function PrimaryButton({ children, icon: Icon = Plus, ...props }) {
  return <button className="primary-button" {...props}>{Icon && <Icon size={17} />}{children}</button>
}

export function IconButton({ children, ...props }) {
  return <button className="icon-btn" {...props}>{children}</button>
}

export function MobileMenuButton({ onClick }) {
  return <button className="icon-btn mobile-menu" onClick={onClick} aria-label="메뉴 열기"><Menu size={20} /></button>
}
