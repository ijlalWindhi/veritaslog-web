export interface IRoleStore {
  address: string | null;
  role: TRole | null;
  setAddress: (addr: string | null) => void;
  setRole: (role: TRole | null) => void;
}

export type TRole = "SUPER_ADMIN" | "ADMIN" | "AUDITOR";
