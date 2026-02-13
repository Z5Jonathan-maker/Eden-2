import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import AnimatedOutlet from './AnimatedOutlet';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import NotificationBell from './NotificationBell';
import { ChevronRight, ChevronDown, Search, Menu, X, LogOut, Radio, Target } from 'lucide-react';
import { APP_LOGO, NAV_ICONS } from '../assets/badges';

var API_URL = process.env.REACT_APP_BACKEND_URL;
const NAV_SECTION_STATE_KEY = 'eden_nav_sections_collapsed_v1';

// 3D Icon component with glow and animation
const NavIcon = ({ src, isActive, size = 'w-6 h-6' }) => (
  <div className={`relative ${size} flex-shrink-0 rounded-md overflow-hidden transition-all duration-300 ${isActive ? 'ring-1 ring-orange-500/40 shadow-[0_0_8px_rgba(234,88,12,0.3)]' : ''}`}>
    <img
      src={src}
      alt=""
      className={`w-full h-full object-cover transition-all duration-300 ${isActive ? 'scale-110 brightness-125' : 'brightness-90 group-hover:brightness-110 group-hover:scale-105'}`}
      loading="lazy"
    />
    {isActive && <div className="absolute inset-0 bg-orange-500/10 animate-pulse rounded-md" />}
  </div>
);

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState([]);
  const [navQuery, setNavQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState({});

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Use permissions from AuthContext user
    if (user && user.permissions) {
      setUserPermissions(user.permissions);
    }
  }, [user]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_SECTION_STATE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object') {
        setCollapsedSections(parsed);
      }
    } catch (_err) {}
  }, []);

  const hasPermission = (perm) => userPermissions.indexOf(perm) !== -1;

  // Navigation: workflow-first grouping for faster daily use.
  const coreOpsItems = [
    { icon: NAV_ICONS.command, label: 'Command', path: '/dashboard' },
    { icon: NAV_ICONS.garden, label: 'Garden', path: '/claims' },
    { icon: NAV_ICONS.harvest, label: 'Harvest', path: '/canvassing' },
    { icon: NAV_ICONS.sales_ops, label: 'Sales Ops', path: '/sales' },
    { icon: NAV_ICONS.recon, label: 'Recon', path: '/inspections' },
    { icon: NAV_ICONS.documents, label: 'Docs', path: '/documents' },
    { icon: NAV_ICONS.contracts, label: 'Contracts', path: '/contracts' },
    { icon: NAV_ICONS.voice_assistant, label: 'Comms', path: '/comms/chat' },
  ];

  const intelligenceItems = [
    { icon: NAV_ICONS.intel_hub, label: 'Intel Hub', path: '/property' },
    { icon: NAV_ICONS.scales, label: 'Scales', path: '/scales' },
    { icon: NAV_ICONS.eve, label: 'Agent Eve', path: '/eve' },
  ];

  const growthItems = [
    { icon: NAV_ICONS.battle_pass, label: 'Battle Pass', path: '/battle-pass' },
    { icon: NAV_ICONS.my_card, label: 'My Card', path: '/mycard' },
    { icon: NAV_ICONS.vision, label: 'Vision', path: '/vision' },
    { icon: NAV_ICONS.doctrine, label: 'Doctrine', path: '/university' },
    { icon: NAV_ICONS.experts, label: 'Experts', path: '/experts' },
    { icon: NAV_ICONS.laws, label: 'Laws', path: '/florida-laws' },
  ];

  const systemItems = [
    { icon: NAV_ICONS.storage, label: 'Storage', path: '/storage' },
    { icon: NAV_ICONS.data_ops, label: 'Data Ops', path: '/data', permission: 'data.export' },
    { icon: NAV_ICONS.squad, label: 'Squad', path: '/users', permission: 'users.read' },
    { icon: NAV_ICONS.settings, label: 'Config', path: '/settings' },
  ];

  const adminItems = user?.role === 'admin'
    ? [{ icon: NAV_ICONS.adam_qa, label: 'Adam QA', path: '/adam' }]
    : [];

  const applyPermissions = (items) =>
    items.filter(item => !item.permission || hasPermission(item.permission));

  const sectionedItems = [
    { title: 'Core Ops', items: coreOpsItems },
    { title: 'Intelligence', items: intelligenceItems },
    { title: 'Growth', items: growthItems },
    { title: 'System', items: applyPermissions(systemItems).concat(adminItems) },
  ];

  const visibleSections = sectionedItems
    .map((section) => {
      const filteredItems = section.items.filter((item) =>
        item.label.toLowerCase().includes(navQuery.toLowerCase().trim())
      );
      return { ...section, items: filteredItems };
    })
    .filter((section) => section.items.length > 0);

  const toggleSection = (title) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        localStorage.setItem(NAV_SECTION_STATE_KEY, JSON.stringify(next));
      } catch (_err) {}
      return next;
    });
  };

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (!user?.full_name) return 'OP';
    return user.full_name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Tactical Sidebar */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        w-64 lg:w-64 bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-800/50
        transition-all duration-300 ease-out
        flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.5)]
      `}>
        {/* Logo - Operation Eden */}
        <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img src={APP_LOGO} alt="Operation Eden" className="w-10 h-10 object-contain animate-glow-breathe" style={{ filter: 'drop-shadow(0 0 10px rgba(234, 88, 12, 0.4))' }} />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-zinc-900 animate-scale-pulse" style={{ boxShadow: '0 0 8px rgba(34, 197, 94, 0.8)' }} />
            </div>
            <div>
              <span className="text-sm font-tactical font-bold text-white tracking-wider">OPERATION</span>
              <span className="text-sm font-tactical font-bold text-orange-500 tracking-wider ml-1">EDEN</span>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Tactical Ops</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-zinc-800 rounded-lg lg:hidden transition-colors text-zinc-400"
            data-testid="sidebar-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation - Tactical Style with 3D Icons */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Find module..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/40"
              data-testid="sidebar-search"
            />
          </div>

          {visibleSections.map((section) => {
            const isCollapsed = Boolean(collapsedSections[section.title]);
            return (
              <div key={section.title} className="pb-2">
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-2 py-2 text-[10px] font-mono font-semibold text-zinc-600 uppercase tracking-widest hover:text-zinc-400 transition-colors"
                  data-testid={`sidebar-section-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <span>{section.title}</span>
                  {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {!isCollapsed && (
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => {
                          navigate(item.path);
                          if (window.innerWidth < 1024) setSidebarOpen(false);
                        }}
                        className={`group w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 relative ${
                          isActive(item.path)
                            ? 'nav-tactical-active bg-orange-500/10 text-orange-400 shadow-[inset_0_0_20px_rgba(234,88,12,0.05)]'
                            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 hover:shadow-[inset_0_0_15px_rgba(255,255,255,0.02)]'
                        }`}
                        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <NavIcon src={item.icon} isActive={isActive(item.path)} />
                        <span className="font-medium text-sm font-tactical tracking-wide">{item.label}</span>
                        {isActive(item.path) && (
                          <ChevronRight className="ml-auto w-4 h-4 text-orange-500 animate-fade-in-left" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {visibleSections.length === 0 && (
            <div className="px-3 py-4 text-center text-xs font-mono text-zinc-500 uppercase tracking-wider">
              No modules found
            </div>
          )}
        </nav>

        {/* User Profile - Tactical Style */}
        <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/50">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-lg flex items-center justify-center border border-zinc-600/50 shadow-[0_0_12px_rgba(234,88,12,0.15)] animate-glow-breathe">
                <span className="text-orange-400 font-tactical font-bold text-sm">{getUserInitials()}</span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900 animate-scale-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-tactical font-semibold text-zinc-200 truncate" data-testid="user-name">
                {user?.full_name || 'Operator'}
              </p>
              <div className="flex items-center gap-1.5">
                <Radio className="w-2.5 h-2.5 text-green-500" />
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{user?.role || 'Agent'}</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-3 py-2 px-3 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2 hover:shadow-[0_0_12px_rgba(239,68,68,0.1)]"
            data-testid="logout-btn"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-tactical">Disconnect</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto lg:ml-0 bg-zinc-950">
        {/* Top Header - Tactical HUD Style */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800/50 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-zinc-800 rounded-lg lg:hidden transition-all duration-200 text-zinc-400"
              data-testid="mobile-menu-btn"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2 lg:hidden">
              <img src={APP_LOGO} alt="Operation Eden" className="w-8 h-8 object-contain" style={{ filter: 'drop-shadow(0 0 8px rgba(234, 88, 12, 0.3))' }} />
              <div>
                <span className="text-sm font-tactical font-bold text-white tracking-wider">OP</span>
                <span className="text-sm font-tactical font-bold text-orange-500 tracking-wider ml-0.5">EDEN</span>
              </div>
            </div>
            {/* Breadcrumb / Status */}
            <div className="hidden lg:flex items-center gap-2 text-xs font-mono">
              <Target className="w-3 h-3 text-orange-500 animate-scale-pulse" />
              <span className="text-zinc-500">SECTOR:</span>
              <span className="text-orange-400 uppercase animate-shimmer">{location.pathname.split('/')[1] || 'HOME'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </div>
        
        {/* Page Content with Tactical Background */}
        <div className="bg-zinc-950 min-h-[calc(100vh-64px)] relative">
          <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />
          <AnimatedOutlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
