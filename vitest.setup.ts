import "@testing-library/jest-dom/vitest";

import { navigationStub } from "./src/test/navigation-stub";

vi.mock("next/navigation", () => ({
  usePathname: () => navigationStub.pathname,
  useSearchParams: () => new URLSearchParams(navigationStub.search),
  useRouter: () => ({
    replace: navigationStub.replace,
    push: navigationStub.push,
  }),
}));

beforeEach(() => {
  navigationStub.pathname = "/";
  navigationStub.search = "";
  navigationStub.replace.mockReset();
  navigationStub.push.mockReset();
});
