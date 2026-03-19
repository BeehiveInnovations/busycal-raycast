/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Quick Add - Hide the Raycast window after a Quick Add command succeeds. */
  "hideOnQuickAdd": boolean,
  /** Upcoming Horizon - How many days the Upcoming command should look ahead by default. */
  "defaultUpcomingDays": "3" | "7" | "14" | "30",
  /** Upcoming Results - Include tasks alongside events in the Upcoming command. */
  "includeTasksInUpcoming": boolean,
  /** Availability Duration - The default minimum slot length used by Find Next Available Time. */
  "defaultMinimumAvailabilityMinutes": "15" | "30" | "45" | "60" | "90",
  /** Availability Scope - Use BusyCal's working-hours window by default when finding availability. */
  "defaultRespectWorkingHours": boolean
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `create-event` command */
  export type CreateEvent = ExtensionPreferences & {}
  /** Preferences accessible in the `create-task` command */
  export type CreateTask = ExtensionPreferences & {}
  /** Preferences accessible in the `quick-add-event` command */
  export type QuickAddEvent = ExtensionPreferences & {}
  /** Preferences accessible in the `quick-add-task` command */
  export type QuickAddTask = ExtensionPreferences & {}
  /** Preferences accessible in the `search-items` command */
  export type SearchItems = ExtensionPreferences & {}
  /** Preferences accessible in the `upcoming-items` command */
  export type UpcomingItems = ExtensionPreferences & {}
  /** Preferences accessible in the `find-next-available` command */
  export type FindNextAvailable = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `create-event` command */
  export type CreateEvent = {}
  /** Arguments passed to the `create-task` command */
  export type CreateTask = {}
  /** Arguments passed to the `quick-add-event` command */
  export type QuickAddEvent = {
  /** Lunch tomorrow at 1pm /Work */
  "inputText": string
}
  /** Arguments passed to the `quick-add-task` command */
  export type QuickAddTask = {
  /** Finish expense report tomorrow /Work */
  "inputText": string
}
  /** Arguments passed to the `search-items` command */
  export type SearchItems = {}
  /** Arguments passed to the `upcoming-items` command */
  export type UpcomingItems = {}
  /** Arguments passed to the `find-next-available` command */
  export type FindNextAvailable = {}
}

