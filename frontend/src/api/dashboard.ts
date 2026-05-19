import api from "./client";
import { DashboardMetrics } from "@/types";

export const dashboardApi = {
  metrics: () => api.get<DashboardMetrics>("/dashboard/metrics"),
};
