import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function makeRequest(
  pathname: string,
  cookies: Record<string, string> = {}
): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  const req = new NextRequest(url);
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

describe("Role-based proxy guard", () => {
  it("allows public paths through without auth", () => {
    const res = proxy(makeRequest("/"));
    expect(res.status).toBe(200);
  });

  it("allows arena landing page (public)", () => {
    const res = proxy(makeRequest("/arena"));
    expect(res.status).toBe(200);
  });

  it("redirects unauthenticated users to login for protected pages", () => {
    const res = proxy(makeRequest("/rewards"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login");
  });

  it("allows authenticated users through protected pages", () => {
    const res = proxy(
      makeRequest("/rewards", { "privy-token": "test-token" })
    );
    expect(res.status).toBe(200);
  });

  it("redirects creators away from /arena/game", () => {
    const res = proxy(
      makeRequest("/arena/game?session=abc", {
        "privy-token": "test-token",
        clearance_role: "creator",
        clearance_onboarded: "1",
      })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/creator-hub");
  });

  it("redirects fans away from /creator-hub", () => {
    const res = proxy(
      makeRequest("/creator-hub", {
        "privy-token": "test-token",
        clearance_role: "fan",
        clearance_onboarded: "1",
      })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/arena");
  });

  it("allows creators to access /creator-hub", () => {
    const res = proxy(
      makeRequest("/creator-hub", {
        "privy-token": "test-token",
        clearance_role: "creator",
        clearance_onboarded: "1",
      })
    );
    expect(res.status).toBe(200);
  });

  it("allows fans to access /arena/game", () => {
    const res = proxy(
      makeRequest("/arena/game?session=abc", {
        "privy-token": "test-token",
        clearance_role: "fan",
        clearance_onboarded: "1",
      })
    );
    expect(res.status).toBe(200);
  });

  it("allows API routes through without role check", () => {
    const res = proxy(makeRequest("/api/users"));
    expect(res.status).toBe(200);
  });

  it("does not enforce roles when not onboarded", () => {
    const res = proxy(
      makeRequest("/arena/game?session=abc", {
        "privy-token": "test-token",
        clearance_role: "creator",
      })
    );
    expect(res.status).toBe(200);
  });
});
