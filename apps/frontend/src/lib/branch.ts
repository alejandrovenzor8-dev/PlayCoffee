import type { User } from "@/types/auth.types";

export const DEFAULT_BRANCH_ID = "branch-1";

export function getActiveBranchId(user?: Pick<User, "branchId"> | null) {
  return user?.branchId ?? DEFAULT_BRANCH_ID;
}
