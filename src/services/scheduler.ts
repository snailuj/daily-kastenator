import { Plugin } from 'obsidian';
import { KastenatorSettings } from '../types';

/**
 * Handles scheduling of daily notifications
 *
 * Approach: Uses a combination of interval checking and time calculation
 * to ensure notifications fire at the correct local time, accounting for
 * timezone changes and app restarts.
 */
export class NotificationScheduler {
  private plugin: Plugin;
  private settings: KastenatorSettings;
  private onNotification: () => void;
  private checkInterval: number | null = null;
  private scheduledTimeout: number | null = null;

  // Check every 5 minutes if we need to fire
  private static readonly CHECK_INTERVAL_MS = 5 * 60 * 1000;

  constructor(
    plugin: Plugin,
    settings: KastenatorSettings,
    onNotification: () => void
  ) {
    this.plugin = plugin;
    this.settings = settings;
    this.onNotification = onNotification;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (!this.settings.notificationEnabled) return;

    // Schedule the next notification
    this.scheduleNext();

    // Also set up interval checking as a backup
    this.checkInterval = window.setInterval(
      () => this.checkAndNotify(),
      NotificationScheduler.CHECK_INTERVAL_MS
    );

    // Register interval with Obsidian for proper cleanup
    this.plugin.registerInterval(this.checkInterval);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.scheduledTimeout !== null) {
      window.clearTimeout(this.scheduledTimeout);
      this.scheduledTimeout = null;
    }
    if (this.checkInterval !== null) {
      window.clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Update settings and reschedule
   */
  updateSettings(settings: KastenatorSettings): void {
    this.settings = settings;
    this.stop();
    this.start();
  }

  /**
   * Calculate milliseconds until the next scheduled notification
   */
  private getMillisecondsUntilNext(): number {
    const now = new Date();
    const target = new Date();

    target.setHours(this.settings.notificationHour);
    target.setMinutes(this.settings.notificationMinute);
    target.setSeconds(0);
    target.setMilliseconds(0);

    // If target time has passed today, schedule for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    return target.getTime() - now.getTime();
  }

  /**
   * Schedule the next notification
   */
  private scheduleNext(): void {
    if (this.scheduledTimeout !== null) {
      window.clearTimeout(this.scheduledTimeout);
    }

    const msUntilNext = this.getMillisecondsUntilNext();

    // JavaScript setTimeout has a max value (~24.8 days)
    // If longer, we rely on interval checking instead
    const maxTimeout = 2147483647;

    if (msUntilNext < maxTimeout) {
      this.scheduledTimeout = window.setTimeout(
        () => this.fireNotification(),
        msUntilNext
      );
    }
  }

  /**
   * Fire the notification and schedule the next one
   */
  private fireNotification(): void {
    const today = new Date().toISOString().split('T')[0];

    // Check if we already notified today
    if (this.settings.lastNotificationDate === today) {
      this.scheduleNext();
      return;
    }

    this.onNotification();
    this.scheduleNext();
  }

  /**
   * Interval-based check for missed notifications
   */
  private checkAndNotify(): void {
    if (!this.settings.notificationEnabled) return;

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Already notified today
    if (this.settings.lastNotificationDate === today) return;

    const targetHour = this.settings.notificationHour;
    const targetMinute = this.settings.notificationMinute;

    // Check if we're past the target time
    const isPastTarget =
      now.getHours() > targetHour ||
      (now.getHours() === targetHour && now.getMinutes() >= targetMinute);

    // Within a small window after target time (30 mins)
    const minutesSinceTarget =
      (now.getHours() - targetHour) * 60 + (now.getMinutes() - targetMinute);
    const withinWindow = isPastTarget && minutesSinceTarget <= 30;

    if (withinWindow) {
      this.fireNotification();
    }
  }

  /**
   * Get human-readable time until next notification
   */
  getTimeUntilNext(): string {
    const ms = this.getMillisecondsUntilNext();
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
