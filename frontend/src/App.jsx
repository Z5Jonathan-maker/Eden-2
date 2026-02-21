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

// Suspense fallback
const PageLoader = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="spinner-tactical w-10 h-10" />
  </div>
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
          <Route path="claims" element={<ClaimsList />} />
          <Route path="claims/new" element={<NewClaim />} />
          <Route path="claims/:claimId" element={<ClaimDetails />} />
          <Route path="claims/:claimId/supplements" element={<SupplementTracker />} />
          <Route path="inspections" element={<InspectionsNew />} />
          <Route path="inspections/classic" element={<InspectionsEnhanced />} />
          <Route path="documents" element={<Documents />} />
          <Route path="eve" element={<EveAI />} />
          <Route path="email-intelligence" element={<EmailIntelligence />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="storage" element={<Documents />} />
          <Route path="data" element={<DataManagement />} />
          <Route path="university" element={<University />} />
          <Route path="university/course/:courseId" element={<CourseDetail />} />
          <Route path="university/article/:articleId" element={<ArticleDetail />} />
          <Route path="university/library/:bookId" element={<BookReader />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="scales" element={<Scales />} />
          <Route path="canvassing" element={<HarvestPage />} />
          <Route path="canvassing/leaderboard" element={<HarvestPage />} />
          <Route path="sales" element={<SalesEnablement />} />
          <Route path="property" element={<PropertyHub />} />
          <Route path="weather" element={<PropertyHub />} />
          <Route path="property-intel" element={<PropertyHub />} />
          <Route path="vision" element={<InteractiveVisionBoard />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/integrations" element={<IntegrationsPage />} />
          <Route path="settings/integrations/callback" element={<IntegrationsPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="gamma" element={<GammaIntegration />} />
          <Route path="voice-assistant" element={<VoiceAssistantConsole />} />
          <Route path="harvest-admin" element={<HarvestAdminConsole />} />
          <Route path="incentives-admin" element={<IncentivesAdminConsole />} />
          <Route path="performance" element={<PerformanceConsole />} />
          <Route path="qa" element={<Adam />} />
          <Route path="adam" element={<Adam />} />
          <Route path="experts" element={<IndustryExperts />} />
          <Route path="florida-laws" element={<FloridaLaws />} />
          <Route path="battle-pass" element={<BattlePass />} />
          <Route path="mycard" element={<MyCard />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="comms/chat" element={<ChatLayout />} />
          <Route path="comms/chat/:channelId" element={<ChatLayout />} />
          <Route path="comms/claim/:claimId" element={<CommCenterThread />} />
        </Route>
        {/* Public Routes (no auth required) */}
        <Route path="/card/:slug" element={<PublicCard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
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
