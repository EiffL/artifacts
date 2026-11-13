import { NextRequest } from "next/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { proxy } from "./proxy";

const ID = "b9c4c481ad2dfa225f167fd845f5e7be";
const SHA = "9eabcbcf5f74453ba542b42f8291766f2d4683ac";

function request(host: string, path: string) {
  return new NextRequest(`http://${host}${path}`, { headers: { host } });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy in path mode", () => {
  test("adds the trailing slash artifact base URLs need", () => {
    vi.stubEnv("ARTIFACTS_ROOT_DOMAIN", "");
    const bare = proxy(request("viewer.example", `/a/${ID}?x=1`));
    expect(bare.status).toBe(308);
    expect(bare.headers.get("location")).toBe(`http://viewer.example/a/${ID}/?x=1`);

    const pinned = proxy(request("viewer.example", `/a/${ID}/@${SHA}`));
    expect(pinned.headers.get("location")).toBe(`http://viewer.example/a/${ID}/@${SHA}/`);
  });

  test("passes every other request through", () => {
    vi.stubEnv("ARTIFACTS_ROOT_DOMAIN", "");
    for (const path of ["/", "/dashboard", `/g/${ID}`, `/a/${ID}/`, `/a/${ID}/data.json`]) {
      const response = proxy(request("viewer.example", path));
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  });
});

describe("framed view addresses", () => {
  test("sends addresses that cannot be a Gist ID to the not-found page", () => {
    vi.stubEnv("ARTIFACTS_ROOT_DOMAIN", "");
    const rewritten = proxy(request("viewer.example", "/g/nope"));
    expect(new URL(rewritten.headers.get("x-middleware-rewrite")!).pathname).toBe("/not-an-artifact");
    expect(proxy(request("viewer.example", `/g/${ID}`)).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(request("viewer.example", `/g/${ID.toUpperCase()}`)).headers.get("x-middleware-next")).toBe("1");
  });
});

describe("proxy in subdomain mode", () => {
  test("rewrites everything on an artifact host to the file route", () => {
    vi.stubEnv("ARTIFACTS_ROOT_DOMAIN", "viewer.example");
    const cases: [string, string][] = [
      // The router treats `/a/<id>` and `/a/<id>/` alike once the request is rewritten.
      ["/", `/a/${ID}`],
      ["/data.json", `/a/${ID}/data.json`],
      [`/@${SHA}/style.css`, `/a/${ID}/@${SHA}/style.css`],
      // Application routes are not reachable from an artifact origin.
      ["/dashboard", `/a/${ID}/dashboard`],
      ["/api/auth/login", `/a/${ID}/api/auth/login`],
    ];
    for (const [path, expected] of cases) {
      const response = proxy(request(`${ID}.viewer.example`, path));
      expect(new URL(response.headers.get("x-middleware-rewrite")!).pathname).toBe(expected);
    }
  });

  test("adds the trailing slash to a pinned root", () => {
    vi.stubEnv("ARTIFACTS_ROOT_DOMAIN", "viewer.example");
    const response = proxy(request(`${ID}.viewer.example`, `/@${SHA}`));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`http://${ID}.viewer.example/@${SHA}/`);
  });

  test("refuses unknown subdomains and leaves the application host alone", () => {
    vi.stubEnv("ARTIFACTS_ROOT_DOMAIN", "viewer.example");
    expect(proxy(request("www.viewer.example", "/")).status).toBe(404);
    expect(proxy(request("viewer.example", "/dashboard")).headers.get("x-middleware-next")).toBe("1");
  });
});
