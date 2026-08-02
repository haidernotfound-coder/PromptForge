import type { AdminOverviewBundle } from "@/lib/admin/overview";
import type { ServerHealth } from "@/lib/admin/health";

export interface AdminBundle extends AdminOverviewBundle {
  health: ServerHealth;
}
