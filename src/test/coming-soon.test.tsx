import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: vi.fn() }));

import { toast } from "sonner";

import { MobileNav } from "@/components/tv/MobileNav";
import { TopBar } from "@/components/tv/TopBar";

const noop = () => {};

beforeEach(() => {
  vi.mocked(toast).mockClear();
});

describe("logo and login open a floating notice, not luofilm.site", () => {
  it("desktop header logo is a button, not a link", () => {
    render(<TopBar tab="live" onTab={noop} query="" onQuery={noop} />);

    expect(screen.getByRole("button", { name: "Movie Max" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Movie Max" })).toBeNull();
  });

  it("clicking the desktop header logo floats the coming soon notice", () => {
    render(<TopBar tab="live" onTab={noop} query="" onQuery={noop} />);

    fireEvent.click(screen.getByRole("button", { name: "Movie Max" }));

    expect(vi.mocked(toast)).toHaveBeenCalledWith(
      "Coming soon",
      expect.objectContaining({ description: expect.stringContaining("Movie Max") }),
    );
  });

  it("clicking desktop login floats the coming soon notice", () => {
    render(<TopBar tab="live" onTab={noop} query="" onQuery={noop} />);

    const login = screen.getByRole("button", { name: "Login" });
    expect(login.tagName).toBe("BUTTON");

    fireEvent.click(login);

    expect(vi.mocked(toast)).toHaveBeenCalledWith("Coming soon", expect.anything());
  });

  it("mobile bar logo and login float the coming soon notice instead of navigating", () => {
    render(<MobileNav tab="live" onTab={noop} />);

    const logo = screen.getByRole("button", { name: "Movie Max" });
    const login = screen.getByRole("button", { name: "Login" });
    expect(logo.tagName).toBe("BUTTON");
    expect(login.tagName).toBe("BUTTON");
    expect(screen.queryByRole("link", { name: "Movie Max" })).toBeNull();

    fireEvent.click(logo);
    fireEvent.click(login);

    expect(vi.mocked(toast)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(toast)).toHaveBeenLastCalledWith("Coming soon", expect.anything());
  });
});
