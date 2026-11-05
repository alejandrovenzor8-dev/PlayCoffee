"use client";
import { useQuery } from '@tanstack/react-query';
import { printApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { getActiveBranchId } from '@/lib/branch';
export function useCashierPrintPolicy() {
  const user = useAuthStore(state => state.user);
  return useQuery({ queryKey: ['cashier-print-policy', getActiveBranchId(user)], queryFn: printApi.cashierPolicy, staleTime: 15000, refetchOnWindowFocus: true });
}
