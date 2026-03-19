import { getPreferenceValues, Icon, List } from "@raycast/api";
import { useEffect, useState } from "react";
import { queryBusyCalItems } from "./busycal-automation";
import { busyCalSortTimestamp, formatOccurrence } from "./busycal-date";
import { resolveBusyCalInstallation } from "./busycal-installation";
import { BusyCalItem, BusyCalInstallation, Preferences } from "./types";
import { BusyCalItemActions } from "./item-actions";

/**
 * Raycast command entry point for the upcoming BusyCal list.
 */
export default function UpcomingItemsCommand() {
  const preferences = getPreferenceValues<Preferences>();
  const [installation, setInstallation] = useState<BusyCalInstallation>();
  const [items, setItems] = useState<BusyCalItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let didCancel = false;

    async function loadUpcomingItems() {
      try {
        const resolvedInstallation = await resolveBusyCalInstallation();
        const horizonDays = Number(preferences.defaultUpcomingDays || "7");
        const startDate = new Date();
        const endDate = new Date(
          startDate.getTime() + horizonDays * 24 * 60 * 60 * 1000,
        );
        const types = preferences.includeTasksInUpcoming
          ? (["event", "task"] as const)
          : (["event"] as const);
        const upcomingItems = await queryBusyCalItems(resolvedInstallation, {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          itemTypes: [...types],
          fetchLimit: 100,
        });
        const sortedItems = [...upcomingItems].sort(
          (left, right) =>
            (busyCalSortTimestamp(left) ?? Number.MAX_SAFE_INTEGER) -
            (busyCalSortTimestamp(right) ?? Number.MAX_SAFE_INTEGER),
        );

        if (!didCancel) {
          setInstallation(resolvedInstallation);
          setItems(sortedItems);
          setErrorMessage(undefined);
        }
      } catch (error) {
        if (!didCancel) {
          setErrorMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      } finally {
        if (!didCancel) {
          setIsLoading(false);
        }
      }
    }

    void loadUpcomingItems();
    return () => {
      didCancel = true;
    };
  }, [preferences.defaultUpcomingDays, preferences.includeTasksInUpcoming]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Upcoming BusyCal items">
      {errorMessage ? (
        <List.EmptyView
          title="BusyCal unavailable"
          description={errorMessage}
        />
      ) : null}
      {!errorMessage && items.length === 0 ? (
        <List.EmptyView
          title="No upcoming items"
          description="Try increasing the default upcoming horizon in preferences."
        />
      ) : null}
      {items.map((item) => (
        <List.Item
          key={item.id}
          icon={item.type === "task" ? Icon.Circle : Icon.Calendar}
          title={item.title || "Untitled"}
          subtitle={item.location}
          accessories={[{ text: formatOccurrence(item) ?? item.type }]}
          actions={
            installation ? (
              <BusyCalItemActions installation={installation} item={item} />
            ) : undefined
          }
        />
      ))}
    </List>
  );
}
