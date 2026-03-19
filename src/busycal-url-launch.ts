/**
 * Returns the `open` arguments used for BusyCal custom URLs.
 */
export function busyCalURLLaunchArguments(
  appPath: string,
  url: string,
): string[] {
  if (appPath.trim().length > 0) {
    return ["-a", appPath, url];
  }

  return [url];
}
