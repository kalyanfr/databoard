import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Home from '@/pages/Home';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Realtime from '@/pages/Realtime';
import Analytics from '@/pages/Analytics';
import Funnels from '@/pages/Funnels';
import Goals from '@/pages/Goals';
import Users from '@/pages/Users';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import Uptime from '@/pages/Uptime';
import Settings from '@/pages/Settings';
import Support from '@/pages/Support';
import Admin from '@/pages/Admin';
import AdminOverview from '@/pages/admin/Overview';
import AdminUsers from '@/pages/admin/Users';
import AdminProjects from '@/pages/admin/Projects';
import AdminMonitors from '@/pages/admin/Monitors';
import AdminMarketing from '@/pages/admin/Marketing';
import AdminSettings from '@/pages/admin/Settings';
import AdminSupport from '@/pages/admin/Support';
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import PublicDashboard from '@/pages/PublicDashboard';
import PaymentSuccess from '@/pages/PaymentSuccess';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Navigate to="/#pricing" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/support" element={<Support />} />
      <Route path="/offer" element={<Navigate to="/#pricing" replace />} />
      <Route path="/launch-offer" element={<Navigate to="/#pricing" replace />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/share/:shareId" element={<PublicDashboard />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/realtime" element={<Realtime />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/search-console" element={<Navigate to="/analytics" replace />} />
          <Route path="/funnels" element={<Funnels />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/users" element={<Users />} />
          <Route path="/ai-crawlers" element={<Navigate to="/analytics?tab=crawlers" replace />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/uptime" element={<Uptime />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="projects" element={<AdminProjects />} />
            <Route path="monitors" element={<AdminMonitors />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="marketing" element={<AdminMarketing />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
