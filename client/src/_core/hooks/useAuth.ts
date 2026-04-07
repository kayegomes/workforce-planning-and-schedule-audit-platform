export function useAuth() {
  return {
    user: {
      id: 1,
      openId: "mock-user",
      name: "Usuário Padrão",
      email: "admin@example.com",
      role: "admin" as const,
    },
    loading: false,
    error: null,
    isAuthenticated: true,
    refresh: () => Promise.resolve(),
    logout: () => Promise.resolve(),
  };
}
