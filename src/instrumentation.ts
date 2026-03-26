export async function register() {
  const { serverEnv } = await import("@/lib/env");
  // Access a property to trigger validation
  void serverEnv.DATABASE_URL;
}
