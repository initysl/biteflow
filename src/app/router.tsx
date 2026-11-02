import { Navigate, createBrowserRouter } from 'react-router';
import { DinerLayout } from '@/features/diner/DinerLayout';
import { MenuPage } from '@/features/diner/MenuPage';
import { OrdersPage } from '@/features/diner/OrdersPage';
import { LandingPage } from '@/pages/LandingPage';
import { NotFoundPage, RouteErrorPage } from '@/pages/NotFoundPage';

// The staff console is never needed by diners, so it ships as a separate chunk.
const staff = () => import('@/features/staff/routes');

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage />, errorElement: <RouteErrorPage /> },
  {
    path: '/t/:tableId',
    element: <DinerLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <MenuPage /> },
      { path: 'orders', element: <OrdersPage /> },
    ],
  },
  {
    path: '/staff/login',
    lazy: async () => ({ Component: (await staff()).LoginPage }),
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/staff',
    lazy: async () => ({ Component: (await staff()).StaffLayout }),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to='kitchen' replace /> },
      { path: 'kitchen', lazy: async () => ({ Component: (await staff()).KitchenPage }) },
      { path: 'floor', lazy: async () => ({ Component: (await staff()).FloorPage }) },
      { path: 'menu', lazy: async () => ({ Component: (await staff()).MenuAdminPage }) },
      { path: 'tables', lazy: async () => ({ Component: (await staff()).TablesPage }) },
      { path: 'reports', lazy: async () => ({ Component: (await staff()).ReportsPage }) },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
