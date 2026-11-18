import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp.tsx';
import UserApp from './UserApp.tsx';
import './index.css';

function isAdminRouteActive(): boolean {
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash === 'admin' || hash.startsWith('admin/')) return true;
  const params = new URLSearchParams(window.location.search);
  return params.get('panel') === 'admin';
}

function StudioRoot() {
  const [adminView, setAdminView] = useState<boolean>(() => isAdminRouteActive());

  useEffect(() => {
    const sync = () => setAdminView(isAdminRouteActive());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  return adminView ? <AdminApp /> : <UserApp />;
}

createRoot(document.getElementById('root')!).render(<StudioRoot />);
