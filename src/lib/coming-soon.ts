import { toast } from "sonner";

/**
 * Floating notice used for parts of the app that are not wired up yet
 * (logo, login). Keeps the wording in one place so both the desktop
 * header and the mobile bar say the same thing.
 */
export function comingSoon() {
  toast("Coming soon", {
    description: "This part of Movie Max is still being built.",
  });
}
