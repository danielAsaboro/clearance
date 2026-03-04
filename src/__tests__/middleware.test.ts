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

describe("Proxy middleware", () => {
  it("allows public paths through without auth", () => {
    const res = proxy(makeRequest("/"));
    expect(res.status).toBe(200);
  });

  it("allows arena landing page (public)", () => {
    const res = proxy(makeRequest("/arena"));
    expect(res.status).toBe(200);
  });

  it("allows auth pages (public)", () => {
    const res = proxy(makeRequest("/auth/login"));
    expect(res.status).toBe(200);
  });

  it("allows referral pages (public)", () => {
    const res = proxy(makeRequest("/ref/abc123"));
    expect(res.status).toBe(200);
  });

  it("redirects unauthenticated users to login for protected pages", () => {
    const res = proxy(makeRequest("/rewards"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login");
  });

  it("includes redirect param when redirecting to login", () => {
    const res = proxy(makeRequest("/leaderboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("redirect=%2Fleaderboard");
  });

  it("allows authenticated users through protected pages", () => {
    const res = proxy(
      makeRequest("/rewards", { "privy-token": "test-token" })
    );
    expect(res.status).toBe(200);
  });

  it("allows authenticated users to access game page", () => {
    const res = proxy(
      makeRequest("/arena/game?session=abc", {
        "privy-token": "test-token",
      })
    );
    expect(res.status).toBe(200);
  });

  it("allows API routes through without auth check", () => {
    const res = proxy(makeRequest("/api/users"));
    expect(res.status).toBe(200);
  });

  it("allows static asset paths through", () => {
    const res = proxy(makeRequest("/_next/static/chunk.js"));
    expect(res.status).toBe(200);
  });

  it("allows file paths with extensions through", () => {
    const res = proxy(makeRequest("/icon-512x512.png"));
    expect(res.status).toBe(200);
  });
});
