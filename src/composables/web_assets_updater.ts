/* eslint-disable @typescript-eslint/no-explicit-any */
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Loading, QSpinnerDots, Dialog } from 'quasar';
import { UpdateInfo } from '../models/updater.model';
import { Capacitor } from '@capacitor/core';

class assetsUpdater {
  private readonly APP_VERSION_KEY = 'appVersion';
  private previousVersion: string | null = null;

  private isAndroidApp(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  private async getLocalVersion(): Promise<string> {
    try {
      const storedVersion = localStorage.getItem(this.APP_VERSION_KEY);
      if (storedVersion) {
        return storedVersion;
      }
    } catch (error) {
      console.error('Failed to get local version from storage:', error);
    }
    return process.env.APP_VERSION || '1.0.0';
  }

  private async setLocalVersion(version: string): Promise<void> {
    try {
      localStorage.setItem(this.APP_VERSION_KEY, version);
    } catch (error) {
      console.error('Failed to set local version:', error);
    }
  }

  promptForUpdate(updateInfo: UpdateInfo): void {
    if (!this.isAndroidApp()) {
      return;
    }
    Dialog.create({
      title: 'Update Available',
      message: `A new version (${updateInfo.version}) is available. Would you like to update now?`,
      cancel: true,
      persistent: true,
    }).onOk(() => {
      this.performUpdate(updateInfo);
    });
  }

  async performUpdate(updateInfo: UpdateInfo): Promise<void> {
    if (!this.isAndroidApp()) {
      console.log('Update skipped: Not an Android app');
      return;
    }
    try {
      const downloadedUpdate = await this.downloadUpdate(updateInfo);
      if (downloadedUpdate) {
        this.previousVersion = await this.getLocalVersion();
        await this.applyUpdate(downloadedUpdate);
      }
    } catch (error) {
      console.error('Update process failed:', error);
      await this.rollbackUpdate();
    }
  }

  async downloadUpdate(updateInfo: UpdateInfo): Promise<any> {
    if (!this.isAndroidApp()) {
      console.log('Download skipped: Not an Android app');
      return null;
    }
    try {
      console.log('Downloading update from:', updateInfo.url);
      Loading.show({
        spinner: QSpinnerDots,
        message: 'Downloading update...',
      });
      const downloadedUpdate = await CapacitorUpdater.download({
        version: updateInfo.version,
        url: updateInfo.url,
      });
      Loading.hide();
      console.log('Update downloaded:', downloadedUpdate);
      return downloadedUpdate;
    } catch (error) {
      Loading.hide();
      console.error('Failed to download update:', error);
      return null;
    }
  }

  async applyUpdate(downloadedUpdate: any): Promise<void> {
    if (!this.isAndroidApp()) {
      console.log('Apply update skipped: Not an Android app');
      return;
    }
    try {
      Loading.show({
        spinner: QSpinnerDots,
        message: 'Applying update...',
      });
      await CapacitorUpdater.set(downloadedUpdate);
      await this.setLocalVersion(downloadedUpdate.version);
      Loading.hide();
      Dialog.create({
        title: 'Update Successful',
        message: 'The app has been updated. It will now restart.',
        ok: 'Ok',
      }).onOk(() => {
        window.location.reload();
      });
    } catch (err) {
      Loading.hide();
      console.error('Update failed:', err);
      await this.rollbackUpdate();
    }
  }

  async rollbackUpdate(): Promise<void> {
    if (!this.isAndroidApp() || !this.previousVersion) {
      console.log(
        'Rollback skipped: Not an Android app or no previous version'
      );
      return;
    }
    try {
      Loading.show({
        spinner: QSpinnerDots,
        message: 'Rolling back update...',
      });
      await CapacitorUpdater.reset();
      await this.setLocalVersion(this.previousVersion);
      Loading.hide();
      Dialog.create({
        title: 'Update Failed',
        message:
          'The update failed and has been rolled back. The app will now restart.',
        ok: 'Restart',
      }).onOk(() => {
        window.location.reload();
      });
    } catch (err) {
      Loading.hide();
      console.error('Rollback failed:', err);
      Dialog.create({
        title: 'Rollback Failed',
        message:
          'There was an error rolling back the update. Please restart the app manually.',
      });
    }
  }
}

export default new assetsUpdater();
