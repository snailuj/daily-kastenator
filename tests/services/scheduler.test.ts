import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationScheduler } from '../../src/services/scheduler';
import { Plugin } from '../mocks/obsidian';
import { KastenatorSettings } from '../../src/types';

const createDefaultSettings = (): KastenatorSettings => ({
  notificationHour: 9,
  notificationMinute: 0,
  quarryFolders: ['Fleeting notes', 'Source notes'],
  migrationField: 'Migration',
  quarryValue: 'quarry',
  atomFolder: 'Atoms',
  atomTemplatePath: '',
  lastNotificationDate: '',
  notificationEnabled: true,
});

describe('NotificationScheduler', () => {
  let plugin: Plugin;
  let settings: KastenatorSettings;
  let onNotification: ReturnType<typeof vi.fn>;
  let scheduler: NotificationScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    plugin = new Plugin();
    settings = createDefaultSettings();
    onNotification = vi.fn();
    scheduler = new NotificationScheduler(plugin as any, settings, onNotification);
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  describe('start', () => {
    it('registers interval with plugin', () => {
      scheduler.start();

      expect(plugin.registerInterval).toHaveBeenCalled();
    });

    it('does not start when notifications disabled', () => {
      settings.notificationEnabled = false;

      scheduler.start();

      expect(plugin.registerInterval).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('clears scheduled timeout', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      scheduler.start();

      scheduler.stop();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('clears interval', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      scheduler.start();

      scheduler.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('restarts scheduler with new settings', () => {
      scheduler.start();
      const newSettings = { ...settings, notificationHour: 14 };

      scheduler.updateSettings(newSettings);

      // Should have re-registered interval
      expect(plugin.registerInterval).toHaveBeenCalledTimes(2);
    });

    it('stops scheduler when notifications disabled', () => {
      scheduler.start();
      const newSettings = { ...settings, notificationEnabled: false };

      scheduler.updateSettings(newSettings);

      // Should have only registered once (initial start)
      expect(plugin.registerInterval).toHaveBeenCalledTimes(1);
    });
  });

  describe('notification timing', () => {
    it('fires notification at scheduled time', () => {
      // Set current time to 8:55 AM
      const now = new Date();
      now.setHours(8, 55, 0, 0);
      vi.setSystemTime(now);

      settings.notificationHour = 9;
      settings.notificationMinute = 0;
      scheduler.start();

      // Advance 5 minutes to 9:00 AM
      vi.advanceTimersByTime(5 * 60 * 1000);

      // May fire once from timeout or additionally from interval check
      expect(onNotification).toHaveBeenCalled();
    });

    it('does not fire before scheduled time', () => {
      const now = new Date();
      now.setHours(8, 0, 0, 0);
      vi.setSystemTime(now);

      settings.notificationHour = 9;
      settings.notificationMinute = 0;
      scheduler.start();

      // Advance 30 minutes (still before 9:00)
      vi.advanceTimersByTime(30 * 60 * 1000);

      expect(onNotification).not.toHaveBeenCalled();
    });

    it('schedules for next day if time has passed', () => {
      // Set current time to 10:00 AM (past 9:00 schedule)
      const now = new Date();
      now.setHours(10, 0, 0, 0);
      vi.setSystemTime(now);

      settings.notificationHour = 9;
      settings.notificationMinute = 0;
      scheduler.start();

      // Advance to end of day - should not fire
      vi.advanceTimersByTime(14 * 60 * 60 * 1000);
      expect(onNotification).not.toHaveBeenCalled();

      // Advance to next morning 9:00
      vi.advanceTimersByTime(9 * 60 * 60 * 1000);
      expect(onNotification).toHaveBeenCalled();
    });

    it('does not fire if already notified today', () => {
      const now = new Date();
      now.setHours(8, 55, 0, 0);
      vi.setSystemTime(now);

      settings.lastNotificationDate = now.toISOString().split('T')[0];
      scheduler.start();

      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(onNotification).not.toHaveBeenCalled();
    });

    it('fires via interval check when exact timeout missed', () => {
      // Simulate scenario where app was closed during scheduled time
      const now = new Date();
      now.setHours(9, 10, 0, 0); // 10 minutes past schedule
      vi.setSystemTime(now);

      settings.notificationHour = 9;
      settings.notificationMinute = 0;
      settings.lastNotificationDate = ''; // Not notified today
      scheduler.start();

      // Trigger interval check (5 minute interval)
      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(onNotification).toHaveBeenCalledTimes(1);
    });

    it('does not fire via interval if outside 30-minute window', () => {
      const now = new Date();
      now.setHours(10, 0, 0, 0); // 1 hour past schedule
      vi.setSystemTime(now);

      settings.notificationHour = 9;
      settings.notificationMinute = 0;
      settings.lastNotificationDate = '';
      scheduler.start();

      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(onNotification).not.toHaveBeenCalled();
    });
  });

  describe('getTimeUntilNext', () => {
    it('returns time in hours and minutes when more than an hour away', () => {
      const now = new Date();
      now.setHours(7, 0, 0, 0);
      vi.setSystemTime(now);

      settings.notificationHour = 9;
      settings.notificationMinute = 0;

      const time = scheduler.getTimeUntilNext();

      expect(time).toBe('2h 0m');
    });

    it('returns time in minutes only when less than an hour away', () => {
      const now = new Date();
      now.setHours(8, 30, 0, 0);
      vi.setSystemTime(now);

      settings.notificationHour = 9;
      settings.notificationMinute = 0;

      const time = scheduler.getTimeUntilNext();

      expect(time).toBe('30m');
    });

    it('calculates time to next day when past schedule', () => {
      const now = new Date();
      now.setHours(10, 0, 0, 0);
      vi.setSystemTime(now);

      settings.notificationHour = 9;
      settings.notificationMinute = 0;

      const time = scheduler.getTimeUntilNext();

      expect(time).toBe('23h 0m');
    });

    it('accounts for non-zero minutes in schedule', () => {
      const now = new Date();
      now.setHours(8, 0, 0, 0);
      vi.setSystemTime(now);

      settings.notificationHour = 9;
      settings.notificationMinute = 30;

      const time = scheduler.getTimeUntilNext();

      expect(time).toBe('1h 30m');
    });
  });

  describe('edge cases', () => {
    it('handles midnight transition', () => {
      const now = new Date();
      now.setHours(23, 55, 0, 0);
      vi.setSystemTime(now);

      settings.notificationHour = 0;
      settings.notificationMinute = 5;
      scheduler.start();

      // Advance 10 minutes past midnight
      vi.advanceTimersByTime(10 * 60 * 1000);

      // Should fire at least once (may fire from both timeout and interval)
      expect(onNotification).toHaveBeenCalled();
    });

    it('handles schedule at minute 45', () => {
      const now = new Date();
      now.setHours(9, 40, 0, 0);
      vi.setSystemTime(now);

      settings.notificationHour = 9;
      settings.notificationMinute = 45;
      scheduler.start();

      vi.advanceTimersByTime(5 * 60 * 1000);

      // Should fire at least once
      expect(onNotification).toHaveBeenCalled();
    });

    it('reschedules after firing', () => {
      const now = new Date();
      now.setHours(8, 55, 0, 0);
      vi.setSystemTime(now);

      settings.notificationHour = 9;
      settings.notificationMinute = 0;
      scheduler.start();

      // Fire first notification
      vi.advanceTimersByTime(5 * 60 * 1000);
      const firstCallCount = onNotification.mock.calls.length;
      expect(firstCallCount).toBeGreaterThanOrEqual(1);

      // Clear the "already notified" flag for testing
      settings.lastNotificationDate = '';

      // Advance 24 hours
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);

      // Should have fired additional times
      expect(onNotification.mock.calls.length).toBeGreaterThan(firstCallCount);
    });
  });
});
