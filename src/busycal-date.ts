import { BusyCalItem } from "./types";

const appleReferenceEpochMs = Date.UTC(2001, 0, 1, 0, 0, 0, 0);
const allDayDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const floatingDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

/**
 * Extracts the BusyCal occurrence seconds encoded into the automation item identifier.
 */
export function withOccurrenceSeconds(
  item: Omit<BusyCalItem, "occurrenceSeconds">,
): BusyCalItem {
  const identifierParts = item.id.split("+");
  const encodedSeconds = Number(identifierParts[1]);

  return {
    ...item,
    occurrenceSeconds: Number.isFinite(encodedSeconds)
      ? encodedSeconds
      : undefined,
  };
}

/**
 * Formats one BusyCal occurrence timestamp for list display.
 */
export function formatOccurrence(item: BusyCalItem): string | undefined {
  const sourceDateString = sourceDateStringForItem(item);
  const showsTime = shouldShowTime(sourceDateString, item.occurrenceSeconds);

  const occurrenceDate = busyCalOccurrenceDate(item);
  if (!occurrenceDate) {
    if (!sourceDateString) {
      return undefined;
    }

    return sourceDateString;
  }

  return formatDate(occurrenceDate, showsTime);
}

/**
 * Returns a BusyCal day URL string for one item.
 */
export function busyCalDateURL(item: BusyCalItem): string | undefined {
  const date = busyCalOccurrenceDate(item);
  if (!date) {
    return undefined;
  }

  return busyCalDateURLForDate(date);
}

/**
 * Returns a sortable timestamp for one BusyCal item.
 */
export function busyCalSortTimestamp(item: BusyCalItem): number | undefined {
  const date = busyCalOccurrenceDate(item);
  if (!date) {
    return undefined;
  }

  return date.getTime();
}

/**
 * Returns the most relevant occurrence date for one BusyCal item.
 */
function busyCalOccurrenceDate(item: BusyCalItem): Date | undefined {
  const sourceDateString = sourceDateStringForItem(item);
  if (item.isFloating && sourceDateString) {
    // BusyCal serializes floating wall-clock times through a UTC formatter, so
    // the original date string is the only lossless source for local display.
    const floatingDate = parseBusyCalDateString(sourceDateString, true);
    if (floatingDate) {
      return floatingDate;
    }
  }

  if (item.occurrenceSeconds !== undefined) {
    return new Date(appleReferenceEpochMs + item.occurrenceSeconds * 1000);
  }

  const date = parseBusyCalDateString(sourceDateString, item.isFloating);
  if (!date) {
    return undefined;
  }

  return date;
}

/**
 * Returns a BusyCal day URL string for one arbitrary date string.
 */
export function busyCalDateURLForDateString(
  dateString: string | undefined,
): string | undefined {
  const parsedDate = parseBusyCalDateString(dateString);
  if (!parsedDate) {
    return undefined;
  }

  return busyCalDateURLForDate(parsedDate);
}

function busyCalDateURLForDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `busycalevent://date/${year}-${month}-${day}`;
}

function firstDefined(
  ...values: Array<string | undefined>
): string | undefined {
  return values.find((value) => value && value.length > 0);
}

function sourceDateStringForItem(item: BusyCalItem): string | undefined {
  if (item.primaryDate) {
    return item.primaryDate;
  }

  if (item.type === "task") {
    return firstDefined(item.dueDate, item.occurrenceDate, item.startDate);
  }

  return firstDefined(item.startDate, item.occurrenceDate, item.dueDate);
}

function parseBusyCalDateString(
  dateString: string | undefined,
  treatsTimeAsFloating = false,
): Date | undefined {
  if (!dateString) {
    return undefined;
  }

  const allDayMatch = dateString.match(allDayDatePattern);
  if (allDayMatch) {
    const [, year, month, day] = allDayMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  if (treatsTimeAsFloating) {
    const floatingMatch = dateString.match(floatingDateTimePattern);
    if (floatingMatch) {
      const [, year, month, day, hours, minutes, seconds = "0"] = floatingMatch;
      return new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds),
      );
    }
  }

  const parsedDate = new Date(dateString);
  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  return parsedDate;
}

function shouldShowTime(
  dateString: string | undefined,
  occurrenceSeconds: number | undefined,
): boolean {
  if (!dateString) {
    return occurrenceSeconds !== undefined;
  }

  // BusyCal emits all-day items as bare YYYY-MM-DD strings. Everything else is
  // a timed value, even for tasks, so Raycast should keep the time visible.
  return !allDayDatePattern.test(dateString);
}

function formatDate(date: Date, showsTime: boolean): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: showsTime ? "short" : undefined,
  }).format(date);
}
