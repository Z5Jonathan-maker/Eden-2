import './App.css';
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster as SonnerToaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import ApiConnectivityToast from './components/ApiConnectivityToast';

// Core (eagerly loaded)
import LandingPage from './components/LandingPage';
import Layout from './shared/layouts/Layout';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Register from './components/Register';
import InstallPrompt from './components/InstallPrompt';
import InstallGuide from './components/InstallGuide';
import NotFoundPage from './components/NotFoundPage';
import RouteErrorBoundary from './components/RouteErrorBoundary';

// Lazy-loaded heavy components
const ClaimsList = lazy(() => import('./features/claims/components/ClaimsList'));
const ClaimDetails = lazy(() => import('./features/claims/components/ClaimDetails'));
const NewClaim = lazy(() => import('./components/NewClaim'));
const InspectionsEnhanced = lazy(() => import('./components/InspectionsEnhanced'));
const InspectionsNew = lazy(() => import('./components/InspectionsNew'));
const Documents = lazy(() => import('./features/documents/components/DocumentsPage'));
const EveAI = lazy(() => import('./features/ai/components/EveAI'));
const EmailIntelligence = lazy(() => import('./features/email-intelligence/EmailIntelligence'));
const Contracts = lazy(() => import('./features/contracts/components/ContractsPage'));
const Settings = lazy(() => import('./components/Settings'));
const Adam = lazy(() => import('./components/Adam'));
const ClientPortal = lazy(() => import('./components/ClientPortal'));
const ClientClaimDetails = lazy(() => import('./features/claims/components/ClientClaimDetails'));
const DataManagement = lazy(() => import('./components/DataManagement'));
const University = lazy(() => import('./components/University'));
const CourseDetail = lazy(() => import('./components/CourseDetail'));
const ArticleDetail = lazy(() => import('./components/ArticleDetail'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const SupplementTracker = lazy(() => import('./components/SupplementTracker'));
const Scales = lazy(() => import('./components/Scales'));
const HarvestPage = lazy(() => import('./components/HarvestPage'));
const SalesEnablement = lazy(() => import('./components/SalesEnablement'));
const InteractiveVisionBoard = lazy(() => import('./components/InteractiveVisionBoard'));
const ClientEducationHub = lazy(() => import('./components/ClientEducationHub'));
const ClaimStatusPortal = lazy(() => import('./features/claims/components/ClaimStatusPortal'));
const VoiceAssistantConsole = lazy(() => import('./components/VoiceAssistantConsole'));
const HarvestAdminConsole = lazy(() => import('./components/HarvestAdminConsole'));
const IncentivesAdminConsole = lazy(() => import('./components/IncentivesAdminConsole'));
const GammaIntegration = lazy(() => import('./components/GammaIntegration'));
const PropertyHub = lazy(() => import('./components/PropertyHub'));
const IndustryExperts = lazy(() => import('./components/IndustryExperts'));
const FloridaLaws = lazy(() => import('./components/FloridaLaws'));
const BattlePass = lazy(() => import('./features/incentives/components/BattlePass'));
const MyCard = lazy(() => import('./components/MyCard'));
const PublicCard = lazy(() => import('./components/PublicCard'));
const ChatLayout = lazy(() => import('./components/chat/ChatLayout'));
const CommCenterThread = lazy(() => import('./components/CommCenterThread'));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const RepLayout = lazy(() => import('./shared/layouts/RepLayout'));
const RepHome = lazy(() => import('./components/rep/RepHome'));
const PerformanceConsole = lazy(() => import('./components/performance/PerformanceConsole'));
const BookReader = lazy(() => import('./components/university/BookReader'));
const WorkbookViewer = lazy(() => import('./components/university/WorkbookViewer'));

// Suspense fallback
const PageLoader = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="spinner-tactical w-10 h-10" />
  </div>
);

// Wrap lazy components with error boundary for per-module crash recovery
const Safe = ({ label, children }) => (
  <RouteErrorBoundary label={label}>{children}</RouteErrorBoundary>
);

// Protected Route wrapper for staff (admin/adjuster)
const StaffRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="spinner-tactical w-12 h-12"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect clients to their portal
  if (user?.role === 'client') {
    return <Navigate to="/client" replace />;
  }

  return children;
};

// Protected Route wrapper for clients
const ClientRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="spinner-tactical w-12 h-12"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Allow clients and staff to access client portal (staff can preview)
  return children;
};

// Smart redirect after login based on role
const PostLoginRedirect = () => {
  const { user } = useAuth();

  if (user?.role === 'client') {
    return <Navigate to="/client" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/install" element={<InstallGuide />} />

        {/* Public Status Portal - No auth required */}
        <Route path="/status/:claimId" element={<ClaimStatusPortal />} />

        {/* Client Portal Routes */}
        <Route
          path="/client"
          element={
            <ClientRoute>
              <ClientPortal />
            </ClientRoute>
          }
        />
        <Route
          path="/client/claims/:claimId"
          element={
            <ClientRoute>
              <ClientClaimDetails />
            </ClientRoute>
          }
        />
        <Route
          path="/client/learn"
          element={
            <ClientRoute>
              <ClientEducationHub />
            </ClientRoute>
          }
        />

        {/* Rep Routes (Mobile-first player UI) */}
        <Route
          path="/rep"
          element={
            <StaffRoute>
              <RepLayout />
            </StaffRoute>
          }
        >
          <Route index element={<RepHome />} />
          <Route
            path="competitions"
            element={
              <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
                <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-4">
                  <span className="text-3xl">🏆</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Competitions</h2>
                <p className="text-zinc-400 text-sm max-w-sm">Team competitions and leaderboard challenges are being built. Check back soon.</p>
              </div>
            }
          />
          <Route
            path="competitions/:id"
            element={
              <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
                <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-4">
                  <span className="text-3xl">🏆</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Competition Detail</h2>
                <p className="text-zinc-400 text-sm max-w-sm">Competition details view is being built. Check back soon.</p>
              </div>
            }
          />
          <Route
            path="profile"
            element={
              <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4">
                  <span className="text-3xl">👤</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Rep Profile</h2>
                <p className="text-zinc-400 text-sm max-w-sm">Your field rep profile and stats are being built. Check back soon.</p>
              </div>
            }
          />
        </Route>

        {/* Staff Routes (Admin/Adjuster) */}
        <Route
          path="/"
          element={
            <StaffRoute>
              <Layout />
            </StaffRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="claims" element={<Safe label="Garden"><ClaimsList /></Safe>} />
          <Route path="claims/new" element={<Safe label="New Claim"><NewClaim /></Safe>} />
          <Route path="claims/:claimId" element={<Safe label="Claim Detail"><ClaimDetails /></Safe>} />
          <Route path="claims/:claimId/supplements" element={<Safe label="Supplements"><SupplementTracker /></Safe>} />
          <Route path="inspections" element={<Safe label="Recon"><InspectionsNew /></Safe>} />
          <Route path="inspections/classic" element={<Safe label="Inspections"><InspectionsEnhanced /></Safe>} />
          <Route path="documents" element={<Safe label="Documents"><Documents /></Safe>} />
          <Route path="eve" element={<Safe label="Eve AI"><EveAI /></Safe>} />
          <Route path="email-intelligence" element={<Safe label="Email Intel"><EmailIntelligence /></Safe>} />
          <Route path="contracts" element={<Safe label="Contracts"><Contracts /></Safe>} />
          <Route path="storage" element={<Safe label="Storage"><Documents /></Safe>} />
          <Route path="data" element={<Safe label="Data Ops"><DataManagement /></Safe>} />
          <Route path="university" element={<Safe label="Doctrine"><University /></Safe>} />
          <Route path="university/course/:courseId" element={<Safe label="Course"><CourseDetail /></Safe>} />
          <Route path="university/article/:articleId" element={<Safe label="Article"><ArticleDetail /></Safe>} />
          <Route path="university/library/:bookId" element={<Safe label="Library"><BookReader /></Safe>} />
          <Route path="university/workbook/:workbookId" element={<Safe label="Workbook"><WorkbookViewer /></Safe>} />
          <Route path="users" element={<Safe label="Squad"><UserManagement /></Safe>} />
          <Route path="scales" element={<Safe label="Scales"><Scales /></Safe>} />
          <Route path="canvassing" element={<Safe label="Harvest"><HarvestPage /></Safe>} />
          <Route path="canvassing/leaderboard" element={<Safe label="Harvest"><HarvestPage /></Safe>} />
          <Route path="sales" element={<Safe label="Sales Ops"><SalesEnablement /></Safe>} />
          <Route path="property" element={<Safe label="Intel Hub"><PropertyHub /></Safe>} />
          <Route path="weather" element={<Safe label="Weather"><PropertyHub /></Safe>} />
          <Route path="property-intel" element={<Safe label="Property Intel"><PropertyHub /></Safe>} />
          <Route path="vision" element={<Safe label="Vision"><InteractiveVisionBoard /></Safe>} />
          <Route path="settings" element={<Safe label="Settings"><Settings /></Safe>} />
          <Route path="settings/integrations" element={<Safe label="Integrations"><IntegrationsPage /></Safe>} />
          <Route path="settings/integrations/callback" element={<Safe label="Integrations"><IntegrationsPage /></Safe>} />
          <Route path="integrations" element={<Safe label="Integrations"><IntegrationsPage /></Safe>} />
          <Route path="gamma" element={<Safe label="Gamma"><GammaIntegration /></Safe>} />
          <Route path="voice-assistant" element={<Safe label="Voice"><VoiceAssistantConsole /></Safe>} />
          <Route path="harvest-admin" element={<Safe label="Harvest Admin"><HarvestAdminConsole /></Safe>} />
          <Route path="incentives-admin" element={<Safe label="Incentives"><IncentivesAdminConsole /></Safe>} />
          <Route path="performance" element={<Safe label="Performance"><PerformanceConsole /></Safe>} />
          <Route path="qa" element={<Safe label="QA"><Adam /></Safe>} />
          <Route path="adam" element={<Safe label="Adam"><Adam /></Safe>} />
          <Route path="experts" element={<Safe label="Experts"><IndustryExperts /></Safe>} />
          <Route path="florida-laws" element={<Safe label="Laws"><FloridaLaws /></Safe>} />
          <Route path="battle-pass" element={<Safe label="Battle Pass"><BattlePass /></Safe>} />
          <Route path="mycard" element={<Safe label="My Card"><MyCard /></Safe>} />
          <Route path="workspace" element={<Safe label="Workspace"><WorkspacePage /></Safe>} />
          <Route path="comms/chat" element={<Safe label="Comms"><ChatLayout /></Safe>} />
          <Route path="comms/chat/:channelId" element={<Safe label="Comms"><ChatLayout /></Safe>} />
          <Route path="comms/claim/:claimId" element={<Safe label="Comms"><CommCenterThread /></Safe>} />
        </Route>
        {/* Public Routes (no auth required) */}
        <Route path="/card/:slug" element={<PublicCard />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <div className="App">
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <InstallPrompt />
            <ApiConnectivityToast />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <AppRoutes />
              </Suspense>
            </BrowserRouter>
            <SonnerToaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                duration: 4000,
              }}
            />
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
