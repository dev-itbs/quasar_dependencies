import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Dialog } from 'quasar';
import updaterService from '../services/updater.service';
import { UpdateInfo } from '../models/updater.model';
import { Capacitor } from '@capacitor/core';
import assetsUpdater from './web_assets_updater';
import apkUpdater from './apk_updater';

class Updater {
  private readonly VERSION_KEYS = {
    apk: 'apkVersion',
    assets: 'assetsVersion',
  };

  private isAndroidApp(): boolean {
    const platform = Capacitor.getPlatform();
    console.log('Current platform:', platform);
    return platform === 'android';
  }

  async initialize(): Promise<void> {
    console.log('Initializing updater...');
    console.log('Current APP_VERSION:', process.env.APP_VERSION);

    if (!this.isAndroidApp()) {
      console.log('Updater is disabled for non-Android platforms');
      return;
    }

    // Initialize local storage with current versions if not set
    await this.initializeVersions();

    // Log current versions
    console.log(
      'Current APK version:',
      localStorage.getItem(this.VERSION_KEYS.apk)
    );
    console.log(
      'Current assets version:',
      localStorage.getItem(this.VERSION_KEYS.assets)
    );

    await CapacitorUpdater.notifyAppReady();
    await this.checkForUpdates();

    // Check for updates periodically (e.g., every 30 minutes)
    setInterval(() => this.checkForUpdates(), 30 * 60 * 1000);
  }

  private async initializeVersions(): Promise<void> {
    const currentAppVersion = process.env.APP_VERSION || '1.0.0';
    console.log('Initializing versions with:', currentAppVersion);

    // Initialize APK version if not set
    if (!localStorage.getItem(this.VERSION_KEYS.apk)) {
      localStorage.setItem(this.VERSION_KEYS.apk, currentAppVersion);
      console.log('Initialized APK version:', currentAppVersion);
    }

    // Initialize assets version if not set
    if (!localStorage.getItem(this.VERSION_KEYS.assets)) {
      localStorage.setItem(this.VERSION_KEYS.assets, currentAppVersion);
      console.log('Initialized assets version:', currentAppVersion);
    }
  }

  async checkForUpdates(): Promise<void> {
    console.log('Checking for updates...');
    if (!this.isAndroidApp()) {
      console.log('Update check skipped - not Android platform');
      return;
    }
    try {
      const updateInfo = await this.checkForNewVersion();
      console.log('Update check result:', updateInfo);
      if (updateInfo) {
        this.promptForUpdate(updateInfo);
      }
    } catch (error) {
      console.error('Update check failed:', error);
    }
  }

  async checkForNewVersion(): Promise<UpdateInfo | null> {
    try {
      const response = await updaterService.fetchUpdateInfo();
      console.log('Update info response:', response);

      if (!response.data) {
        console.log('No update data received');
        return null;
      }

      // Handle single object response
      const updateInfo = Array.isArray(response.data)
        ? response.data[0]
        : response.data;
      console.log('Processing update info:', updateInfo);

      const remoteVersion = updateInfo.version;
      const localVersion = await this.getLocalVersion(updateInfo.updateType);

      console.log(
        'Version comparison:\n',
        `- Local ${updateInfo.updateType} version: ${localVersion}\n`,
        `- Remote ${updateInfo.updateType} version: ${remoteVersion}`
      );

      if (this.isNewerVersion(remoteVersion, localVersion)) {
        console.log('New version detected');
        return {
          version: updateInfo.version,
          updateType: updateInfo.updateType,
          url: updateInfo.url,
          web_assets_url: updateInfo.web_assets_url,
          notes: updateInfo.notes,
          sessionKey: updateInfo.sessionKey,
        };
      }
      console.log('No new version available');
      return null;
    } catch (error) {
      console.error('Version check failed:', error);
      return null;
    }
  }

  private isNewerVersion(remote: string, local: string): boolean {
    if (!remote || !local) {
      console.log('Invalid version strings:', { remote, local });
      return false;
    }

    const remoteParts = remote.split('.').map(Number);
    const localParts = local.split('.').map(Number);

    console.log('Version comparison parts:', {
      remote: remoteParts,
      local: localParts,
    });

    for (let i = 0; i < 3; i++) {
      if (remoteParts[i] > localParts[i]) {
        console.log(`Remote version is newer at position ${i}`);
        return true;
      }
      if (remoteParts[i] < localParts[i]) {
        console.log(`Remote version is older at position ${i}`);
        return false;
      }
    }
    console.log('Versions are equal');
    return false;
  }

  private async getLocalVersion(updateType: string): Promise<string> {
    const key =
      updateType === 'apk' ? this.VERSION_KEYS.apk : this.VERSION_KEYS.assets;
    try {
      const storedVersion = localStorage.getItem(key);
      console.log(
        `Retrieved ${updateType} version from storage:`,
        storedVersion
      );

      if (!storedVersion) {
        const defaultVersion = process.env.APP_VERSION || '1.0.0';
        console.log('No stored version found, using default:', defaultVersion);
        localStorage.setItem(key, defaultVersion);
        return defaultVersion;
      }
      return storedVersion;
    } catch (error) {
      console.error(
        `Failed to get local ${updateType} version from storage:`,
        error
      );
      return process.env.APP_VERSION || '1.0.0';
    }
  }

  async updateLocalVersion(
    updateType: string,
    newVersion: string
  ): Promise<void> {
    const key =
      updateType === 'apk' ? this.VERSION_KEYS.apk : this.VERSION_KEYS.assets;
    try {
      localStorage.setItem(key, newVersion);
      console.log(`Updated local ${updateType} version to:`, newVersion);
    } catch (error) {
      console.error(`Failed to update local ${updateType} version:`, error);
    }
  }

  promptForUpdate(updateInfo: UpdateInfo): void {
    console.log('Prompting for update:', updateInfo);

    if (!this.isAndroidApp()) {
      console.log('Update prompt skipped - not Android platform');
      return;
    }

    Dialog.create({
      title: `${updateInfo.updateType === 'apk' ? 'APK' : 'Update'} Available`,
      message: `A new ${updateInfo.updateType} version (${updateInfo.version}) is available. Would you like to update now?`,
      cancel: true,
      persistent: true,
    })
      .onOk(async () => {
        console.log('User accepted update');
        try {
          if (updateInfo.updateType === 'apk') {
            await apkUpdater.performUpdate(updateInfo);
          } else {
            await assetsUpdater.performUpdate(updateInfo);
          }
          await this.updateLocalVersion(
            updateInfo.updateType,
            updateInfo.version
          );
          console.log('Update completed successfully');
        } catch (error) {
          console.error(`Update failed for ${updateInfo.updateType}:`, error);
          Dialog.create({
            title: 'Update Failed',
            message: 'Failed to install the update. Please try again later.',
            ok: true,
          });
        }
      })
      .onCancel(() => {
        console.log('User cancelled update');
      });
  }
}

export default new Updater();
