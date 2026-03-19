import { open as openURL } from "@raycast/api";
import { openBusyCalAutomationItem } from "./busycal-automation";
import { isUnsupportedOpenItemCommandError } from "./busycal-open-item-support";
import { execFileText } from "./shell";
import { BusyCalInstallation, BusyCalItem } from "./types";
import { busyCalURLLaunchArguments } from "./busycal-url-launch";

/**
 * Opens one BusyCal URL through Launch Services.
 */
export async function openBusyCalURL(
  installation: BusyCalInstallation,
  url: string,
): Promise<void> {
  await execFileText(
    "open",
    busyCalURLLaunchArguments(installation.appPath, url),
  );
}

/**
 * Opens one BusyCal item in the BusyCal UI.
 */
export async function openBusyCalItem(
  installation: BusyCalInstallation,
  item: BusyCalItem,
): Promise<void> {
  const trimmedIdentity = item.id.trim();
  if (trimmedIdentity.length === 0) {
    throw new Error(
      "BusyCal did not return a canonical item identity for reveal.",
    );
  }

  try {
    await openBusyCalAutomationItem(installation, trimmedIdentity);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isUnsupportedOpenItemCommandError(message)) {
      throw new Error(
        "This Raycast extension requires a BusyCal build that supports the `open item` scripting command.",
      );
    }

    throw error;
  }
}

/**
 * Opens one external URL in the system browser.
 */
export async function openExternalURL(url: string): Promise<void> {
  await openURL(url);
}
