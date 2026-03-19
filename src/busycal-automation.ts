import {
  buildGivenClause,
  appleScriptCSV,
  appleScriptString,
  parseSerializedRecords,
  runBusyCalScript,
} from "./busycal-script";
import {
  BusyCalCalendar,
  BusyCalEventInput,
  BusyCalInstallation,
  BusyCalItem,
  BusyCalItemType,
  BusyCalItemQuery,
  BusyCalNaturalLanguageItemInput,
  BusyCalNextAvailableQuery,
  BusyCalNextAvailableResult,
  BusyCalTaskInput,
} from "./types";
import { withOccurrenceSeconds } from "./busycal-date";

/**
 * Lists BusyCal calendars through the app's current scripting surface.
 */
export async function listBusyCalCalendars(
  installation: BusyCalInstallation,
): Promise<BusyCalCalendar[]> {
  const script = `
tell application id ${appleScriptString(installation.bundleId)}
  set rawCalendars to list calendars
end tell
set serializedRecords to {}
repeat with calendarRecord in rawCalendars
  set serializedFields to {¬
    my emitField("accountID", accountID of calendarRecord), ¬
    my emitField("calendarID", calendarID of calendarRecord), ¬
    my emitBooleanField("isSubscribed", isSubscribed of calendarRecord), ¬
    my emitBooleanField("supportsEvents", supportsEvents of calendarRecord), ¬
    my emitBooleanField("supportsTasks", supportsTasks of calendarRecord), ¬
    my emitField("title", title of calendarRecord)}
  set end of serializedRecords to my emitFields(serializedFields)
end repeat
return my emitRecords(serializedRecords)
`;

  const rawOutput = await runBusyCalScript(installation, script);
  return parseSerializedRecords(rawOutput).map((record) => ({
    accountID: record.accountID ?? "",
    calendarID: record.calendarID ?? "",
    isSubscribed: record.isSubscribed === "true",
    supportsEvents: record.supportsEvents === "true",
    supportsTasks: record.supportsTasks === "true",
    title: record.title ?? "",
  }));
}

/**
 * Queries BusyCal items and maps them into the list-friendly item model used by the extension.
 */
export async function queryBusyCalItems(
  installation: BusyCalInstallation,
  query: BusyCalItemQuery,
): Promise<BusyCalItem[]> {
  const strategy = queryBusyCalItemsStrategy(query.itemTypes);

  if (strategy === "task") {
    return queryBusyCalTasks(installation, query);
  }

  const script = buildBusyCalItemsQueryScript(installation.bundleId, query);

  const rawOutput = await runBusyCalScript(installation, script);
  return parseSerializedRecords(rawOutput)
    .map((record) => busyCalItemFromRecord(record))
    .filter((item) => item.id.length > 0);
}

/**
 * Chooses the BusyCal query route that preserves the app's own mixed-item semantics.
 */
export function queryBusyCalItemsStrategy(
  itemTypes?: BusyCalItemType[],
): "mixed" | "task" {
  if (!itemTypes || itemTypes.length !== 1) {
    return "mixed";
  }

  const [itemType] = itemTypes;
  if (itemType === "task") {
    return "task";
  }

  return "mixed";
}

/**
 * Builds the generic `query items` AppleScript used for mixed-type BusyCal queries.
 */
export function buildBusyCalItemsQueryScript(
  bundleId: string,
  query: BusyCalItemQuery,
): string {
  const itemTypesParameter =
    query.itemTypes && query.itemTypes.length > 0
      ? appleScriptCSV(query.itemTypes)
      : undefined;
  const parameters = buildGivenClause([
    query.searchText
      ? `searchText:${appleScriptString(query.searchText)}`
      : undefined,
    query.startDate
      ? `startDate:${appleScriptString(query.startDate)}`
      : undefined,
    query.endDate ? `endDate:${appleScriptString(query.endDate)}` : undefined,
    itemTypesParameter ? `itemTypes:${itemTypesParameter}` : undefined,
    query.fetchLimit !== undefined
      ? `fetchLimit:${query.fetchLimit}`
      : undefined,
  ]);
  const givenClause = parameters.length > 0 ? ` given ${parameters}` : "";

  return `
tell application id ${appleScriptString(bundleId)}
  set rawItems to query items${givenClause}
end tell
set serializedRecords to {}
repeat with itemRecord in rawItems
${buildOptionalPropertyRead("startDateValue", "startDate")}
${buildOptionalPropertyRead("endDateValue", "endDate")}
${buildOptionalPropertyRead("dueDateValue", "dueDate")}
${buildOptionalPropertyRead("locationValue", "location")}
${buildOptionalPropertyRead("seriesUIDValue", "seriesUID")}
${buildOptionalPropertyRead("occurrenceDateValue", "occurrenceDate")}
${buildOptionalPropertyRead("isFloatingValue", "isFloating")}
  set serializedFields to {¬
    my emitField("id", |id| of itemRecord), ¬
    my emitField("title", title of itemRecord), ¬
    my emitField("type", type of itemRecord), ¬
    my emitField("calendarID", calendarID of itemRecord), ¬
    my emitDateField("startDate", startDateValue), ¬
    my emitDateField("endDate", endDateValue), ¬
    my emitDateField("dueDate", dueDateValue), ¬
    my emitField("location", locationValue), ¬
    my emitField("seriesUID", seriesUIDValue), ¬
    my emitDateField("occurrenceDate", occurrenceDateValue), ¬
    my emitBooleanField("isFloating", isFloatingValue)}
  set end of serializedRecords to my emitFields(serializedFields)
end repeat
return my emitRecords(serializedRecords)
`;
}

function buildOptionalPropertyRead(
  variableName: string,
  propertyName: string,
  recordName = "itemRecord",
  indent = "  ",
): string {
  return `${indent}set ${variableName} to missing value
${indent}try
${indent}  set ${variableName} to ${propertyName} of ${recordName}
${indent}end try`;
}

async function queryBusyCalTasks(
  installation: BusyCalInstallation,
  query: BusyCalItemQuery,
): Promise<BusyCalItem[]> {
  const script = buildBusyCalTasksQueryScript(installation.bundleId, query);

  const rawOutput = await runBusyCalScript(installation, script);
  return parseSerializedRecords(rawOutput)
    .map((record) => busyCalItemFromRecord(record, "task"))
    .filter((item) => item.id.length > 0);
}

/**
 * Builds the `query tasks` AppleScript used for task-only BusyCal queries.
 */
export function buildBusyCalTasksQueryScript(
  bundleId: string,
  query: BusyCalItemQuery,
): string {
  const parameters = buildGivenClause([
    query.searchText
      ? `searchText:${appleScriptString(query.searchText)}`
      : undefined,
    query.startDate
      ? `startDate:${appleScriptString(query.startDate)}`
      : undefined,
    query.endDate ? `endDate:${appleScriptString(query.endDate)}` : undefined,
    query.fetchLimit !== undefined
      ? `fetchLimit:${query.fetchLimit}`
      : undefined,
  ]);
  const givenClause = parameters.length > 0 ? ` given ${parameters}` : "";
  return `
tell application id ${appleScriptString(bundleId)}
  set rawItems to query tasks${givenClause}
end tell
set serializedRecords to {}
repeat with itemRecord in rawItems
${buildOptionalPropertyRead("dueDateValue", "dueDate")}
${buildOptionalPropertyRead("occurrenceDateValue", "occurrenceDate")}
${buildOptionalPropertyRead("isFloatingValue", "isFloating")}
  set serializedFields to {¬
    my emitField("id", |id| of itemRecord), ¬
    my emitField("title", title of itemRecord), ¬
    my emitField("calendarID", calendarID of itemRecord), ¬
    my emitDateField("dueDate", dueDateValue), ¬
    my emitField("seriesUID", seriesUID of itemRecord), ¬
    my emitDateField("occurrenceDate", occurrenceDateValue), ¬
    my emitBooleanField("isFloating", isFloatingValue)}
  set end of serializedRecords to my emitFields(serializedFields)
end repeat
return my emitRecords(serializedRecords)
`;
}

/**
 * Finds the next available BusyCal slot matching the request.
 */
export async function findNextBusyCalAvailable(
  installation: BusyCalInstallation,
  query: BusyCalNextAvailableQuery,
): Promise<BusyCalNextAvailableResult | null> {
  const parameters = buildGivenClause([
    query.startDate
      ? `startDate:${appleScriptString(query.startDate)}`
      : undefined,
    query.endDate ? `endDate:${appleScriptString(query.endDate)}` : undefined,
    query.calendarIDs?.length
      ? `calendarIDs:${appleScriptCSV(query.calendarIDs)}`
      : undefined,
    `minimumDurationMinutes:${query.minimumDurationMinutes}`,
    `respectWorkingHours:${query.respectWorkingHours ? "true" : "false"}`,
  ]);
  const script = `
tell application id ${appleScriptString(installation.bundleId)}
  set availabilityResult to find next available given ${parameters}
end tell
if availabilityResult is missing value then
  return ""
end if
set serializedFields to {¬
  my emitDateField("startDate", startDate of availabilityResult), ¬
  my emitDateField("endDate", endDate of availabilityResult), ¬
  my emitField("timeZoneIdentifier", timeZoneIdentifier of availabilityResult)}
return my emitFields(serializedFields)
`;

  const rawOutput = await runBusyCalScript(installation, script);
  if (!rawOutput.trim()) {
    return null;
  }

  const [record] = parseSerializedRecords(rawOutput);
  if (!record) {
    return null;
  }

  return {
    startDate: record.startDate ?? "",
    endDate: record.endDate ?? "",
    timeZoneIdentifier: emptyToUndefined(record.timeZoneIdentifier),
  };
}

/**
 * Creates one structured BusyCal event.
 */
export async function createBusyCalEvent(
  installation: BusyCalInstallation,
  input: BusyCalEventInput,
): Promise<BusyCalItem> {
  const script = buildCreateBusyCalEventScript(installation.bundleId, input);

  const rawOutput = await runBusyCalScript(installation, script);
  const [record] = parseSerializedRecords(rawOutput);
  if (!record) {
    throw new Error("BusyCal did not return the created event.");
  }

  return busyCalItemFromRecord(record, "event");
}

/**
 * Creates one structured BusyCal task.
 */
export async function createBusyCalTask(
  installation: BusyCalInstallation,
  input: BusyCalTaskInput,
): Promise<BusyCalItem> {
  const script = buildCreateBusyCalTaskScript(installation.bundleId, input);
  const rawOutput = await runBusyCalScript(installation, script);
  const [record] = parseSerializedRecords(rawOutput);
  if (!record) {
    throw new Error("BusyCal did not return the created task.");
  }

  return busyCalItemFromRecord(record, "task");
}

/**
 * Creates one BusyCal item through the app's natural-language quick-entry automation command.
 */
export async function createBusyCalNaturalLanguageItem(
  installation: BusyCalInstallation,
  input: BusyCalNaturalLanguageItemInput,
): Promise<BusyCalItem> {
  const script = buildCreateBusyCalNaturalLanguageItemScript(
    installation.bundleId,
    input,
  );
  let rawOutput: string;
  try {
    rawOutput = await runBusyCalScript(installation, script);
  } catch (error) {
    if (isUnsupportedNaturalLanguageCommandError(error)) {
      throw new Error(
        "This BusyCal install does not yet expose the `create natural language item` AppleScript command. Build and deploy the updated BusyCal app, then retry Quick Add.",
      );
    }

    throw error;
  }
  const [record] = parseSerializedRecords(rawOutput);
  if (!record) {
    throw new Error("BusyCal did not return the created quick-add item.");
  }

  return busyCalItemFromRecord(record, input.itemType);
}

/**
 * Reveals one BusyCal item through the app's canonical automation command.
 */
export async function openBusyCalAutomationItem(
  installation: BusyCalInstallation,
  itemID: string,
): Promise<BusyCalItem> {
  const script = buildOpenBusyCalItemScript(installation.bundleId, itemID);
  const rawOutput = await runBusyCalScript(installation, script);
  const [record] = parseSerializedRecords(rawOutput);
  if (!record) {
    throw new Error("BusyCal did not confirm the revealed item.");
  }

  return busyCalItemFromRecord(record);
}

/**
 * Builds the BusyCal AppleScript used to create one structured event.
 */
export function buildCreateBusyCalEventScript(
  bundleId: string,
  input: BusyCalEventInput,
): string {
  const parameters = buildGivenClause([
    `title:${appleScriptString(input.title)}`,
    `startDate:${appleScriptString(input.startDate)}`,
    `endDate:${appleScriptString(input.endDate)}`,
    input.calendarID
      ? `calendarID:${appleScriptString(input.calendarID)}`
      : undefined,
    `allDay:${input.allDay ? "true" : "false"}`,
    input.location
      ? `location:${appleScriptString(input.location)}`
      : undefined,
    input.notes ? `notes:${appleScriptString(input.notes)}` : undefined,
  ]);

  return `
tell application id ${appleScriptString(bundleId)}
  set createdEvent to create event given ${parameters}
end tell
${buildOptionalPropertyRead("locationValue", "location", "createdEvent", "")}
${buildOptionalPropertyRead("occurrenceDateValue", "occurrenceDate", "createdEvent", "")}
${buildOptionalPropertyRead("isFloatingValue", "isFloating", "createdEvent", "")}
set serializedFields to {¬
  my emitField("id", |id| of createdEvent), ¬
  my emitField("title", title of createdEvent), ¬
  my emitField("type", "event"), ¬
  my emitField("calendarID", calendarID of createdEvent), ¬
  my emitDateField("startDate", startDate of createdEvent), ¬
  my emitDateField("endDate", endDate of createdEvent), ¬
  my emitField("location", locationValue), ¬
  my emitField("seriesUID", seriesUID of createdEvent), ¬
  my emitDateField("occurrenceDate", occurrenceDateValue), ¬
  my emitBooleanField("isFloating", isFloatingValue)}
return my emitFields(serializedFields)
`;
}

/**
 * Builds the BusyCal AppleScript used to create one structured task.
 */
export function buildCreateBusyCalTaskScript(
  bundleId: string,
  input: BusyCalTaskInput,
): string {
  const parameters = buildGivenClause([
    `title:${appleScriptString(input.title)}`,
    input.dueDate ? `dueDate:${appleScriptString(input.dueDate)}` : undefined,
    input.calendarID
      ? `calendarID:${appleScriptString(input.calendarID)}`
      : undefined,
    input.notes ? `notes:${appleScriptString(input.notes)}` : undefined,
  ]);

  return `
tell application id ${appleScriptString(bundleId)}
  set createdTask to create task given ${parameters}
end tell
${buildOptionalPropertyRead("dueDateValue", "dueDate", "createdTask", "")}
${buildOptionalPropertyRead("occurrenceDateValue", "occurrenceDate", "createdTask", "")}
${buildOptionalPropertyRead("isFloatingValue", "isFloating", "createdTask", "")}
set serializedFields to {¬
  my emitField("id", |id| of createdTask), ¬
  my emitField("title", title of createdTask), ¬
  my emitField("type", "task"), ¬
  my emitField("calendarID", calendarID of createdTask), ¬
  my emitDateField("dueDate", dueDateValue), ¬
  my emitField("seriesUID", seriesUID of createdTask), ¬
  my emitDateField("occurrenceDate", occurrenceDateValue), ¬
  my emitBooleanField("isFloating", isFloatingValue)}
return my emitFields(serializedFields)
`;
}

/**
 * Builds the BusyCal AppleScript used to create one natural-language item.
 */
export function buildCreateBusyCalNaturalLanguageItemScript(
  bundleId: string,
  input: BusyCalNaturalLanguageItemInput,
): string {
  const parameters = buildGivenClause([
    `text:${appleScriptString(input.text)}`,
    `itemType:${appleScriptString(input.itemType)}`,
    input.calendarID
      ? `calendarID:${appleScriptString(input.calendarID)}`
      : undefined,
    input.notes ? `notes:${appleScriptString(input.notes)}` : undefined,
  ]);

  return `
tell application id ${appleScriptString(bundleId)}
  set createdItem to create natural language item given ${parameters}
end tell
${buildOptionalPropertyRead("startDateValue", "startDate", "createdItem", "")}
${buildOptionalPropertyRead("endDateValue", "endDate", "createdItem", "")}
${buildOptionalPropertyRead("dueDateValue", "dueDate", "createdItem", "")}
${buildOptionalPropertyRead("locationValue", "location", "createdItem", "")}
${buildOptionalPropertyRead("seriesUIDValue", "seriesUID", "createdItem", "")}
${buildOptionalPropertyRead("occurrenceDateValue", "occurrenceDate", "createdItem", "")}
${buildOptionalPropertyRead("isFloatingValue", "isFloating", "createdItem", "")}
set serializedFields to {¬
  my emitField("id", |id| of createdItem), ¬
  my emitField("title", title of createdItem), ¬
  my emitField("type", |type| of createdItem), ¬
  my emitField("calendarID", calendarID of createdItem), ¬
  my emitDateField("startDate", startDateValue), ¬
  my emitDateField("endDate", endDateValue), ¬
  my emitDateField("dueDate", dueDateValue), ¬
  my emitField("location", locationValue), ¬
  my emitField("seriesUID", seriesUIDValue), ¬
  my emitDateField("occurrenceDate", occurrenceDateValue), ¬
  my emitBooleanField("isFloating", isFloatingValue)}
return my emitFields(serializedFields)
`;
}

/**
 * Builds the BusyCal AppleScript used to reveal one structured item by canonical identity.
 */
export function buildOpenBusyCalItemScript(
  bundleId: string,
  itemID: string,
): string {
  return `
tell application id ${appleScriptString(bundleId)}
  set openedItem to open item given itemID:${appleScriptString(itemID)}
end tell
${buildOptionalRecordPropertyRead("startDateValue", "startDate")}
${buildOptionalRecordPropertyRead("endDateValue", "endDate")}
${buildOptionalRecordPropertyRead("dueDateValue", "dueDate")}
${buildOptionalRecordPropertyRead("locationValue", "location")}
${buildOptionalRecordPropertyRead("seriesUIDValue", "seriesUID")}
${buildOptionalRecordPropertyRead("occurrenceDateValue", "occurrenceDate")}
${buildOptionalRecordPropertyRead("isFloatingValue", "isFloating")}
set serializedFields to {¬
  my emitField("id", |id| of openedItem), ¬
  my emitField("title", title of openedItem), ¬
  my emitField("type", |type| of openedItem), ¬
  my emitField("calendarID", calendarID of openedItem), ¬
  my emitDateField("startDate", startDateValue), ¬
  my emitDateField("endDate", endDateValue), ¬
  my emitDateField("dueDate", dueDateValue), ¬
  my emitField("location", locationValue), ¬
  my emitField("seriesUID", seriesUIDValue), ¬
  my emitDateField("occurrenceDate", occurrenceDateValue), ¬
  my emitBooleanField("isFloating", isFloatingValue)}
return my emitFields(serializedFields)
`;
}

/**
 * Reads one optional property from the revealed BusyCal record without assuming event/task parity.
 */
function buildOptionalRecordPropertyRead(
  variableName: string,
  propertyName: string,
): string {
  return `set ${variableName} to missing value
try
  set ${variableName} to ${propertyName} of openedItem
end try`;
}

/**
 * Deletes one BusyCal event by item identifier.
 */
export async function deleteBusyCalEvent(
  installation: BusyCalInstallation,
  itemID: string,
): Promise<void> {
  const script = `
tell application id ${appleScriptString(installation.bundleId)}
  delete event given itemID:${appleScriptString(itemID)}
end tell
return "ok"
`;

  await runBusyCalScript(installation, script);
}

/**
 * Deletes one BusyCal task by item identifier.
 */
export async function deleteBusyCalTask(
  installation: BusyCalInstallation,
  itemID: string,
): Promise<void> {
  const script = `
tell application id ${appleScriptString(installation.bundleId)}
  delete task given itemID:${appleScriptString(itemID)}
end tell
return "ok"
`;

  await runBusyCalScript(installation, script);
}

export function busyCalItemFromRecord(
  record: Record<string, string>,
  fallbackType?: BusyCalItem["type"],
): BusyCalItem {
  const type = (record.type as BusyCalItem["type"]) ?? fallbackType ?? "event";

  return withOccurrenceSeconds({
    id: record.id ?? "",
    title: record.title ?? "",
    type,
    calendarID: record.calendarID ?? "",
    primaryDate: normalizedPrimaryDate(record, type),
    startDate: emptyToUndefined(record.startDate),
    endDate: emptyToUndefined(record.endDate),
    dueDate: emptyToUndefined(record.dueDate),
    location: emptyToUndefined(record.location),
    seriesUID: record.seriesUID ?? "",
    occurrenceDate: emptyToUndefined(record.occurrenceDate),
    isFloating: record.isFloating === "true",
  });
}

function normalizedPrimaryDate(
  record: Record<string, string>,
  type: BusyCalItem["type"],
): string | undefined {
  switch (type) {
    case "task":
      return (
        emptyToUndefined(record.dueDate) ??
        emptyToUndefined(record.occurrenceDate) ??
        emptyToUndefined(record.startDate)
      );
    case "event":
      return (
        emptyToUndefined(record.startDate) ??
        emptyToUndefined(record.occurrenceDate) ??
        emptyToUndefined(record.dueDate)
      );
    default:
      return (
        emptyToUndefined(record.occurrenceDate) ??
        emptyToUndefined(record.startDate) ??
        emptyToUndefined(record.dueDate)
      );
  }
}

export function isUnsupportedNaturalLanguageCommandError(
  error: unknown,
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes("create natural language item") ||
    normalizedMessage.includes("quick add item") ||
    normalizedMessage.includes("doesn’t understand") ||
    normalizedMessage.includes("doesn't understand") ||
    normalizedMessage.includes("expected end of line but found identifier")
  );
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}
