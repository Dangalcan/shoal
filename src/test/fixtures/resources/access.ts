export const mockRoles: any[] = [
  {
    metadata: {
      name: 'role-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
  },
];

export const mockRoleBindings: any[] = [
  {
    metadata: {
      name: 'rb-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    roleRef: { name: 'role-1', kind: 'Role' },
  },
];

export const mockServiceAccounts: any[] = [
  {
    metadata: {
      name: 'sa-1',
      namespace: 'default',
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    secrets: [{ name: 'sa-token' }],
  },
];
