export type Workspace = {
  id: string;
  name: string;
  type: string;
  role?: string;
  memberCount?: number;
};

export type MobileSession = {
  user: {
    id: string;
    email: string;
    name: string;
  };
  accessToken: string;
  refreshToken: string;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
};
