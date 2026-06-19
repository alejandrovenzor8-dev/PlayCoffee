import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Attach access token to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
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
      const refreshToken = localStorage.getItem("refreshToken");

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
            refreshToken,
          });
          localStorage.setItem("accessToken", data.data.accessToken);
          localStorage.setItem("refreshToken", data.data.refreshToken);
          if (original.headers) {
            original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          }
          return api(original);
        } catch {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.location.href = "/login";
        }
      } else {
        window.location.href = "/login";
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

export const productsApi = {
  getAll: (params?: { categoryId?: string; search?: string }) =>
    api.get("/products", { params }).then((r) => r.data.data),
  getCategories: () => api.get("/products/categories").then((r) => r.data.data),
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

export const childAccessApi = {
  getActive: (branchId?: string) =>
    api.get("/child-access/active", { params: { branchId } }).then((r) => r.data.data),
  getOverstaying: (branchId?: string) =>
    api.get("/child-access/overstaying", { params: { branchId } }).then((r) => r.data.data),
  register: (data: unknown) => api.post("/child-access", data).then((r) => r.data.data),
  checkout: (id: string, branchId?: string) =>
    api.patch(`/child-access/${id}/checkout`, undefined, { params: { branchId } }).then((r) => r.data.data),
};

export const reservationsApi = {
  getAll: (params?: { branchId?: string; date?: string }) =>
    api.get("/reservations", { params }).then((r) => r.data.data),
  create: (data: unknown) => api.post("/reservations", data).then((r) => r.data.data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/reservations/${id}/status`, { status }).then((r) => r.data.data),
};

export const reportsApi = {
  getKpis: (branchId: string) =>
    api.get("/reports/kpis", { params: { branchId } }).then((r) => r.data.data),
  getSales: (branchId: string, from: string, to: string) =>
    api.get("/reports/sales", { params: { branchId, from, to } }).then((r) => r.data.data),
  getSummary: (params: { from?: string; to?: string; branchId?: string }) =>
    api.get("/reports/summary", { params }).then((r) => r.data.data),
};

export const inventoryApi = {
  getAll: (search?: string, branchId?: string) =>
    api.get("/inventory", { params: { search, branchId } }).then((r) => r.data.data),
  getItems: (branchId?: string) =>
    api.get("/inventory", { params: { branchId } }).then((r) => r.data.data),
  getMovements: (params?: { itemId?: string; branchId?: string }) =>
    api.get("/inventory/movements", { params }).then((r) => r.data.data),
  create: (data: unknown) => api.post("/inventory", data).then((r) => r.data.data),
  addMovement: (data: unknown) =>
    api.post("/inventory/movements", data).then((r) => r.data.data),
  recordMovement: (data: unknown) =>
    api.post("/inventory/movements", data).then((r) => r.data.data),
};
