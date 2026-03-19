import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useEffect, useState } from "react";
import { queryBusyCalItems } from "./busycal-automation";
import { formatOccurrence } from "./busycal-date";
import { resolveBusyCalInstallation } from "./busycal-installation";
import { BusyCalItem, BusyCalInstallation } from "./types";
import { BusyCalItemActions } from "./item-actions";

/**
 * Raycast command entry point for BusyCal item search.
 */
export default function SearchItemsCommand() {
  const [installation, setInstallation] = useState<BusyCalInstallation>();
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<BusyCalItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let didCancel = false;

    async function loadInstallation() {
      try {
        const resolvedInstallation = await resolveBusyCalInstallation();
        if (!didCancel) {
          setInstallation(resolvedInstallation);
        }
      } catch (error) {
        if (!didCancel) {
          setErrorMessage(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    }

    void loadInstallation();
    return () => {
      didCancel = true;
    };
  }, []);

  useEffect(() => {
    if (!installation) {
      return;
    }

    if (!searchText.trim()) {
      setItems([]);
      return;
    }

    let didCancel = false;
    const timer = setTimeout(() => {
      void (async () => {
        setIsLoading(true);
        try {
          const matchedItems = await queryBusyCalItems(installation, {
            searchText: searchText.trim(),
            itemTypes: ["event", "task"],
            fetchLimit: 50,
          });
          if (!didCancel) {
            setItems(matchedItems);
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
      })();
    }, 250);

    return () => {
      didCancel = true;
      clearTimeout(timer);
    };
  }, [installation, searchText]);

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search BusyCal events and tasks"
      throttle
    >
      {errorMessage ? (
        <List.EmptyView
          title="BusyCal unavailable"
          description={errorMessage}
        />
      ) : null}
      {!errorMessage && !searchText.trim() ? (
        <List.EmptyView
          title="Start typing to search BusyCal"
          description="Searches events and tasks using BusyCal's scripting surface."
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
            ) : (
              <ActionPanel>
                <Action title="BusyCal Is Still Loading" />
              </ActionPanel>
            )
          }
        />
      ))}
    </List>
  );
}
