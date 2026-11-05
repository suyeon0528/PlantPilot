import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Bell, ChevronRight, CircleHelp } from 'lucide-react'
import { useApp } from './context/AppContext'
import { Sidebar, MobileMenuButton, DemoTag } from './components/UI'
import { DashboardPage, PlantsPage, MonitoringPage, PredictionPage, WateringPage, AlertsPage, JournalPage, DevicesPage, NotFoundPage } from './pages/Pages'

const pageNames = {
  '/': '대시보드', '/plants': '내 식물', '/monitoring': '환경 모니터링', '/prediction': '급수 예측',
  '/watering': '자동 급수', '/alerts': '이상 감지 · 알림', '/journal': '성장 기록', '/devices': 'IoT 기기 관리',
}

export default function App() {
  const [mobileNav, setMobileNav] = useState(false)
  const { plants, alerts } = useApp()
  const location = useLocation()
  const title = pageNames[location.pathname] || 'PlantPilot'
  const activeAlerts = alerts.filter((alert) => alert.status === '주의' || alert.status === '위험').length

  return <div className="app-shell">
    {mobileNav && <button className="sidebar-scrim" onClick={() => setMobileNav(false)} aria-label="메뉴 닫기" />}
    <div className={`sidebar-wrap ${mobileNav ? 'mobile-open' : ''}`}><Sidebar onClose={() => setMobileNav(false)} /></div>
    <main className="main-shell">
      <header className="topbar"><div className="topbar-left"><MobileMenuButton onClick={() => setMobileNav(true)} /><div className="breadcrumb"><span>PlantPilot</span><ChevronRight size={14} /><strong>{title}</strong></div></div><div className="topbar-right"><DemoTag /><button className="topbar-icon" onClick={() => window.location.assign('/alerts')} aria-label="알림"><Bell size={18} />{activeAlerts > 0 && <span className="notification-count">{activeAlerts}</span>}</button><div className="topbar-divider" /><div className="topbar-online"><span className={plants.some((plant) => plant.deviceId) ? 'online-indicator' : 'offline-indicator'} />기기 {plants.filter((plant) => plant.deviceId).length}대</div><button className="help-button" title="이 서비스는 데모 시뮬레이션입니다"><CircleHelp size={17} /></button></div></header>
      <div className="page-content"><Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/plants" element={<PlantsPage />} />
        <Route path="/plants/:plantId" element={<MonitoringPage />} />
        <Route path="/monitoring" element={<MonitoringPage />} />
        <Route path="/prediction" element={<PredictionPage />} />
        <Route path="/watering" element={<WateringPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes></div>
      <footer className="app-footer"><span>© 2026 PlantPilot · 스마트 식물 관리 데모</span><span>ESP32 · Spring Boot 연동 준비 중</span></footer>
    </main>
  </div>
}
