import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { BusyCalInstallation } from "./types";
import { execFileText } from "./shell";

const knownBundleIdentifiers = [
  "com.busymac.busycal3",
  "com.busymac.busycal-setapp",
];
const trustedRoots = ["/Applications", path.join(homedir(), "Applications")];
const blockedComponents = new Set([
  "Developer",
  "DerivedData",
  ".DerivedData",
  "build",
  ".build",
  "builds",
]);

/**
 * One installation resolution failure raised before we can send commands to BusyCal.
 */
export class BusyCalInstallationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusyCalInstallationError";
  }
}

/**
 * Returns the BusyCal installation that this extension should target.
 *
 * The resolver prefers the currently running BusyCal edition so Raycast does
 * not silently talk to the wrong install when both direct-download and Setapp
 * copies are present on the same Mac.
 */
export async function resolveBusyCalInstallation(): Promise<BusyCalInstallation> {
  const installed = await discoverBusyCalInstallations();
  if (installed.length === 0) {
    throw new BusyCalInstallationError(
      "BusyCal is not installed in /Applications or ~/Applications.",
    );
  }

  const running = [] as BusyCalInstallation[];
  for (const installation of installed) {
    if (await isBundleRunning(installation.bundleId)) {
      running.push(installation);
    }
  }

  if (running.length === 1) {
    return running[0];
  }

  if (running.length > 1) {
    throw new BusyCalInstallationError(
      "Multiple BusyCal editions are currently running. Quit the extra edition and try again.",
    );
  }

  if (installed.length === 1) {
    return installed[0];
  }

  throw new BusyCalInstallationError(
    "Multiple BusyCal editions are installed. Open the edition you want Raycast to use, then try again.",
  );
}

async function discoverBusyCalInstallations(): Promise<BusyCalInstallation[]> {
  const query = [
    "kMDItemCFBundleIdentifier == 'com.busymac.busycal3'",
    "kMDItemCFBundleIdentifier == 'com.busymac.busycal-setapp'",
  ].join(" || ");
  const output = await execFileText("mdfind", [query]).catch(() => "");
  const candidatePaths = Array.from(
    new Set([
      ...output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      "/Applications/BusyCal.app",
      "/Applications/Setapp/BusyCal.app",
      path.join(homedir(), "Applications", "BusyCal.app"),
    ]),
  ).filter(
    (candidatePath) =>
      existsSync(candidatePath) && isTrustedInstallPath(candidatePath),
  );

  const installationsByBundleId = new Map<string, BusyCalInstallation>();
  for (const candidatePath of candidatePaths) {
    const bundleId = await readBundleIdentifier(candidatePath);
    if (!knownBundleIdentifiers.includes(bundleId)) {
      continue;
    }

    const existing = installationsByBundleId.get(bundleId);
    if (
      !existing ||
      installPathPriority(candidatePath) < installPathPriority(existing.appPath)
    ) {
      installationsByBundleId.set(bundleId, {
        bundleId,
        appPath: candidatePath,
        displayName: "BusyCal",
      });
    }
  }

  return Array.from(installationsByBundleId.values()).sort(
    (left, right) =>
      installPathPriority(left.appPath) - installPathPriority(right.appPath),
  );
}

function isTrustedInstallPath(candidatePath: string): boolean {
  const standardizedPath = path.resolve(candidatePath);
  const withinTrustedRoot = trustedRoots.some(
    (trustedRoot) =>
      standardizedPath === trustedRoot ||
      standardizedPath.startsWith(`${trustedRoot}${path.sep}`),
  );
  if (!withinTrustedRoot) {
    return false;
  }

  return standardizedPath
    .split(path.sep)
    .every((component) => !blockedComponents.has(component));
}

function installPathPriority(candidatePath: string): number {
  if (candidatePath.startsWith("/Applications/BusyCal.app")) {
    return 0;
  }

  if (candidatePath.startsWith("/Applications/Setapp/BusyCal.app")) {
    return 1;
  }

  if (
    candidatePath.startsWith(
      path.join(homedir(), "Applications", "BusyCal.app"),
    )
  ) {
    return 2;
  }

  return 3;
}

async function readBundleIdentifier(appPath: string): Promise<string> {
  const plistPath = path.join(appPath, "Contents", "Info.plist");
  return execFileText("plutil", [
    "-extract",
    "CFBundleIdentifier",
    "raw",
    "-o",
    "-",
    plistPath,
  ]);
}

async function isBundleRunning(bundleId: string): Promise<boolean> {
  const script = `tell application "System Events" to count (every process whose bundle identifier is "${bundleId}")`;
  const output = await execFileText("osascript", ["-e", script]).catch(
    () => "0",
  );
  return Number(output) > 0;
}
