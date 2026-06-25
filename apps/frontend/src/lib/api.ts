import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/auth.store";

function getRequiredPublicUrl(name: "NEXT_PUBLIC_API_URL" | "NEXT_PUBLIC_WS_URL") {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required`);
  }
  return value ?? "http://localhost:3001";
}

const BASE_URL = getRequiredPublicUrl("NEXT_PUBLIC_API_URL");
let refreshPromise: Promise<string | null> | null = null;

function clearClientAuth() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }
  useAuthStore.getState().clearAuth();
}

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Attach access token to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = useAuthStore.getState().accessToken ?? localStorage.getItem("accessToken");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken =
        useAuthStore.getState().refreshToken ?? localStorage.getItem("refreshToken");

      if (refreshToken) {
        try {
          refreshPromise ??= axios
            .post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken })
            .then(({ data }) => {
              const tokens = data.data;
              const currentUser = useAuthStore.getState().user;
              if (!currentUser) return null;
              useAuthStore.getState().setAuth(
                currentUser,
                tokens.accessToken,
                tokens.refreshToken,
              );
              return tokens.accessToken as string;
            })
            .catch(() => {
              clearClientAuth();
              return null;
            })
            .finally(() => {
              refreshPromise = null;
            });

          const accessToken = await refreshPromise;
          if (!accessToken) {
            if (typeof window !== "undefined" && window.location.pathname !== "/login") {
              window.location.href = "/login";
            }
            return Promise.reject(error);
          }

          if (original.headers) {
            original.headers.Authorization = `Bearer ${accessToken}`;
          }
          return api(original);
        } catch {
          clearClientAuth();
          if (typeof window !== "undefined" && window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
      } else {
        clearClientAuth();
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

// Typed helpers
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }).then((r) => r.data.data),
  loginPin: (email: string, pin: string) =>
    api.post("/auth/login/pin", { email, pin }).then((r) => r.data.data),
  logout: () => api.post("/auth/logout"),
  refresh: (refreshToken: string) =>
    api.post("/auth/refresh", { refreshToken }).then((r) => r.data.data),
};

export type ProductPayload = {
  categoryId?: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  imageUrl?: string;
  sku?: string;
  barcode?: string;
  taxRate?: number;
  preparationStation?: "KITCHEN" | "BAR" | "NONE";
  trackInventory?: boolean;
  isFeatured?: boolean;
  isActive?: boolean;
};

export const productsApi = {
  getAll: (params?: { categoryId?: string; search?: string; isActive?: string }) =>
    api.get("/products", { params }).then((r) => r.data.data),
  getCategories: () => api.get("/products/categories").then((r) => r.data.data),
  create: (data: ProductPayload) =>
    api.post("/products", data).then((r) => r.data.data),
  update: (id: string, data: Partial<ProductPayload>) =>
    api.patch(`/products/${id}`, data).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/products/${id}`).then((r) => r.data.data),
};

export const ordersApi = {
  getAll: (params?: { branchId?: string; status?: string }) =>
    api.get("/orders", { params }).then((r) => r.data.data),
  getOne: (id: string) => api.get(`/orders/${id}`).then((r) => r.data.data),
  create: (data: unknown) => api.post("/orders", data).then((r) => r.data.data),
  updateStatus: (id: string, data: { status: string; notes?: string }) =>
    api.patch(`/orders/${id}`, data).then((r) => r.data.data),
  cancel: (id: string) => api.delete(`/orders/${id}`),
  getDailySummary: (branchId: string, date?: string) =>
    api.get("/orders/summary", { params: { branchId, date } }).then((r) => r.data.data),
};

export const tablesApi = {
  getAll: (branchId?: string) =>
    api.get("/tables", { params: { branchId } }).then((r) => r.data.data),
  getByArea: (areaId: string) =>
    api.get("/tables", { params: { areaId } }).then((r) => r.data.data),
  getAreas: (branchId?: string) =>
    api.get("/tables/areas", { params: { branchId } }).then((r) => r.data.data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/tables/${id}/status`, { status }).then((r) => r.data.data),
  update: (id: string, data: unknown) =>
    api.patch(`/tables/${id}`, data).then((r) => r.data.data),
  create: (data: unknown) =>
    api.post("/tables", data).then((r) => r.data.data),
  delete: (id: string) =>
    api.delete(`/tables/${id}`).then((r) => r.data.data),
};

export const areasApi = {
  getAll: (branchId: string) =>
    api.get("/areas", { params: { branchId } }).then((r) => r.data.data),
  getActive: (branchId: string) =>
    api.get("/areas/active", { params: { branchId } }).then((r) => r.data.data),
  getOne: (id: string) =>
    api.get(`/areas/${id}`).then((r) => r.data.data),
  create: (branchId: string, data: unknown) =>
    api.post("/areas", data, { params: { branchId } }).then((r) => r.data.data),
  update: (id: string, data: unknown) =>
    api.patch(`/areas/${id}`, data).then((r) => r.data.data),
  reorder: (branchId: string, areaIds: string[]) =>
    api.post("/areas/reorder", { areaIds }, { params: { branchId } }).then((r) => r.data.data),
  toggleActive: (id: string) =>
    api.patch(`/areas/${id}/toggle-active`).then((r) => r.data.data),
  delete: (id: string) =>
    api.delete(`/areas/${id}`).then((r) => r.data.data),
};

export const paymentsApi = {
  create: (data: unknown) => api.post("/payments", data).then((r) => r.data.data),
  getByOrder: (orderId: string) =>
    api.get(`/payments/order/${orderId}`).then((r) => r.data.data),
};

export const printApi = {
  customer: (orderId: string) =>
    api.get(`/print/order/${orderId}/customer`).then((r) => r.data.data),
  kitchen: (orderId: string) =>
    api.get(`/print/order/${orderId}/kitchen`).then((r) => r.data.data),
  bar: (orderId: string) =>
    api.get(`/print/order/${orderId}/bar`).then((r) => r.data.data),
};

export const cashApi = {
  getCurrent: () => api.get("/cash/current").then((r) => r.data.data),
  open: (data: { openingBalance: number; notes?: string }) =>
    api.post("/cash/open", data).then((r) => r.data.data),
  addMovement: (data: { type: "IN" | "OUT"; amount: number; reason: string }) =>
    api.post("/cash/movements", data).then((r) => r.data.data),
  close: (data: { closingBalance: number; notes?: string }) =>
    api.patch("/cash/close", data).then((r) => r.data.data),
  history: (params?: { from?: string; to?: string }) =>
    api.get("/cash/history", { params }).then((r) => r.data.data),
  detail: (id: string) => api.get(`/cash/${id}`).then((r) => r.data.data),
};

export const childAccessApi = {
  getActive: (branchId?: string) =>
    api.get("/child-access/active", { params: { branchId } }).then((r) => r.data.data),
  getOverstaying: (branchId?: string) =>
    api.get("/child-access/overstaying", { params: { branchId } }).then((r) => r.data.data),
  register: (data: unknown) => api.post("/child-access", data).then((r) => r.data.data),
  checkout: (id: string, data: unknown, branchId?: string) =>
    api.patch(`/child-access/${id}/checkout`, data, { params: { branchId } }).then((r) => r.data.data),
};

export const reservationsApi = {
  getAll: (params?: { branchId?: string; date?: string }) =>
    api.get("/reservations", { params }).then((r) => r.data.data),
  calendar: (params?: { branchId?: string; start?: string; end?: string }) =>
    api.get("/reservations/calendar", { params }).then((r) => r.data.data),
  availability: (params: { branchId?: string; date: string; areaId?: string; duration?: number }) =>
    api.get("/reservations/availability", { params }).then((r) => r.data.data),
  create: (data: unknown) => api.post("/reservations", data).then((r) => r.data.data),
  update: (id: string, data: unknown) =>
    api.patch(`/reservations/${id}`, data).then((r) => r.data.data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/reservations/${id}/status`, { status }).then((r) => r.data.data),
};

export const partyPackagesApi = {
  getAll: (includeInactive = false) =>
    api.get("/party-packages", { params: { includeInactive } }).then((r) => r.data.data),
  create: (data: unknown) => api.post("/party-packages", data).then((r) => r.data.data),
  update: (id: string, data: unknown) =>
    api.patch(`/party-packages/${id}`, data).then((r) => r.data.data),
  delete: (id: string) => api.delete(`/party-packages/${id}`).then((r) => r.data.data),
};

export const reportsApi = {
  getKpis: (branchId: string) =>
    api.get("/reports/kpis", { params: { branchId } }).then((r) => r.data.data),
  getSales: (branchId: string, from: string, to: string) =>
    api.get("/reports/sales", { params: { branchId, from, to } }).then((r) => r.data.data),
  getSummary: (params: { start?: string; end?: string; from?: string; to?: string; branchId?: string }) =>
    api.get("/reports/summary", { params }).then((r) => r.data.data),
  salesByDay: (params: { start?: string; end?: string; branchId?: string }) =>
    api.get("/reports/sales-by-day", { params }).then((r) => r.data.data),
  salesByCategory: (params: { start?: string; end?: string; branchId?: string }) =>
    api.get("/reports/sales-by-category", { params }).then((r) => r.data.data),
  paymentMethods: (params: { start?: string; end?: string; branchId?: string }) =>
    api.get("/reports/payment-methods", { params }).then((r) => r.data.data),
  peakHours: (params: { start?: string; end?: string; branchId?: string }) =>
    api.get("/reports/peak-hours", { params }).then((r) => r.data.data),
  waiterSales: (params: { start?: string; end?: string; branchId?: string }) =>
    api.get("/reports/waiter-sales", { params }).then((r) => r.data.data),
  childAccess: (params: { start?: string; end?: string; branchId?: string }) =>
    api.get("/reports/child-access", { params }).then((r) => r.data.data),
  reservations: (params: { start?: string; end?: string; branchId?: string }) =>
    api.get("/reports/reservations", { params }).then((r) => r.data.data),
  inventoryLowStock: (branchId?: string) =>
    api.get("/reports/inventory-low-stock", { params: { branchId } }).then((r) => r.data.data),
  cashShifts: (params: { start?: string; end?: string; branchId?: string }) =>
    api.get("/reports/cash-shifts", { params }).then((r) => r.data.data),
};

export const inventoryApi = {
  getAll: (search?: string, branchId?: string) =>
    api.get("/inventory", { params: { search, branchId } }).then((r) => r.data.data),
  getItems: (branchId?: string) =>
    api.get("/inventory", { params: { branchId } }).then((r) => r.data.data),
  getLowStock: (branchId?: string) =>
    api.get("/inventory/low-stock", { params: { branchId } }).then((r) => r.data.data),
  getMovements: (params?: { itemId?: string; branchId?: string }) =>
    api.get("/inventory/movements", { params }).then((r) => r.data.data),
  create: (data: unknown) => api.post("/inventory/items", data).then((r) => r.data.data),
  update: (id: string, data: unknown) =>
    api.patch(`/inventory/items/${id}`, data).then((r) => r.data.data),
  addMovement: (data: unknown) =>
    api.post("/inventory/movements", data).then((r) => r.data.data),
  recordMovement: (data: unknown) =>
    api.post("/inventory/movements", data).then((r) => r.data.data),
};
