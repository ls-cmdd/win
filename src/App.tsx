/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './i18n'; // We will create this
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';
import { invoke } from './lib/tauri';

// Layouts & Pages
import MainLayout from './components/MainLayout';
import Dashboard from './features/dashboard/Dashboard';
import Login from './features/auth/Login';
import SubscribersList from './features/subscribers/SubscribersList';
import PlansList from './features/plans/PlansList';
import SubscriptionsList from './features/subscriptions/SubscriptionsList';
import PaymentsList from './features/payments/PaymentsList';
import Settings from './features/settings/Settings';
import Reports from './features/reports/Reports';

function App() {
  const { i18n } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);

  useEffect(() => {
    if (user && user.role) {
      invoke('sync_auth_session', { role: user.role }).catch(console.error);
    } else {
      invoke('sync_auth_session', { role: null }).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    document.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    document.documentElement.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
        
        <Route path="/" element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />}>
          <Route index element={<Dashboard />} />
          <Route path="subscribers" element={<SubscribersList />} />
          <Route path="plans" element={<PlansList />} />
          <Route path="subscriptions" element={<SubscriptionsList />} />
          <Route path="payments" element={<PaymentsList />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
