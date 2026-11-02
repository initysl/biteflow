import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { formatPrice } from '@shared/money';
import type {
  AppConfig,
  AssistanceRequest,
  MenuItem,
  Order,
  ReportSummary,
  RestaurantTable,
  StaffUser,
  TableWithToken,
} from '@shared/schemas';
import { api } from './api';

export const queryKeys = {
  config: ['config'] as const,
  menu: ['menu'] as const,
  me: ['me'] as const,
  table: (id: string) => ['table', id] as const,
  tableOrders: (id: string) => ['table', id, 'orders'] as const,
  tableAssistance: (id: string) => ['table', id, 'assistance'] as const,
  staffOrders: ['staff', 'orders'] as const,
  staffTables: ['staff', 'tables'] as const,
  staffAssistance: ['staff', 'assistance'] as const,
  staffReports: ['staff', 'reports'] as const,
};

export const useConfig = () =>
  useQuery({ queryKey: queryKeys.config, queryFn: () => api<AppConfig>('/config'), staleTime: Infinity });

export function useMoney() {
  const { data } = useConfig();
  const currency = data?.currency ?? 'USD';
  const locale = data?.locale ?? 'en-US';
  return useCallback((cents: number) => formatPrice(cents, currency, locale), [currency, locale]);
}

export const useMenu = () => useQuery({ queryKey: queryKeys.menu, queryFn: () => api<MenuItem[]>('/menu') });

export const useTableInfo = (tableId: string, token: string | null) =>
  useQuery({
    queryKey: [...queryKeys.table(tableId), token],
    queryFn: () =>
      api<{ table: RestaurantTable; canOrder: boolean }>(
        `/tables/${encodeURIComponent(tableId)}${token ? `?k=${encodeURIComponent(token)}` : ''}`,
      ),
    retry: false,
  });

export const useTableOrders = (tableId: string, token: string | null, include: string[]) =>
  useQuery({
    queryKey: [...queryKeys.tableOrders(tableId), include.join(',')],
    queryFn: () =>
      api<Order[]>(`/tables/${encodeURIComponent(tableId)}/orders?k=${encodeURIComponent(token!)}&include=${include.join(',')}`),
    enabled: !!token,
  });

export const useTableAssistance = (tableId: string, token: string | null) =>
  useQuery({
    queryKey: queryKeys.tableAssistance(tableId),
    queryFn: () => api<AssistanceRequest[]>(`/tables/${encodeURIComponent(tableId)}/assistance?k=${encodeURIComponent(token!)}`),
    enabled: !!token,
  });

export const useMe = () =>
  useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<StaffUser>('/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  });

/** Managers approve voids and destructive changes; everyone else asks one. */
export const useIsManager = () => useMe().data?.role === 'manager';

export const useStaffOrders = (enabled = true) =>
  useQuery({ queryKey: queryKeys.staffOrders, queryFn: () => api<Order[]>('/staff/orders'), enabled });

export const useStaffTables = (enabled = true) =>
  useQuery({ queryKey: queryKeys.staffTables, queryFn: () => api<TableWithToken[]>('/staff/tables'), enabled });

export const useStaffAssistance = (enabled = true) =>
  useQuery({ queryKey: queryKeys.staffAssistance, queryFn: () => api<AssistanceRequest[]>('/staff/assistance'), enabled });

export const useReports = () =>
  useQuery({
    queryKey: queryKeys.staffReports,
    queryFn: () => api<ReportSummary>('/staff/reports/summary'),
    refetchInterval: 60_000,
  });
