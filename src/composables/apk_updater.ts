import { Capacitor } from '@capacitor/core';
import { Dialog, Loading, QSpinnerDots } from 'quasar';
import { UpdateInfo } from '../models/updater.model';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { CapacitorHttp } from '@capacitor/core';

class ApkUpdater {
  private isAndroidApp(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  async performUpdate(updateInfo: UpdateInfo): Promise<void> {
    if (!this.isAndroidApp()) {
      console.log('APK update skipped: Not an Android app');
      return;
    }

    let fileInfo: { uri: string } | null = null;

    try {
      Loading.show({
        spinner: QSpinnerDots,
        message: 'Downloading APK...',
      });

      // Download the APK
      const response = await CapacitorHttp.get({
        url: updateInfo.url,
        responseType: 'blob',
      });

      if (response.status === 200 && response.data) {
        const filePath = 'update.apk'; // This will be in the root of the cache directory

        // Write the blob data to a file
        await Filesystem.writeFile({
          path: filePath,
          data: response.data,
          directory: Directory.Cache,
        });

        Loading.hide();

        // Get the full path of the file
        fileInfo = await Filesystem.getUri({
          directory: Directory.Cache,
          path: filePath,
        });

        await this.launchInstaller(fileInfo, updateInfo);
      } else {
        throw new Error('APK download failed');
      }
    } catch (error) {
      Loading.hide();
      console.error('APK update process failed:', error);

      if (fileInfo) {
        // If we have the file info, offer to retry installation
        this.offerRetryInstallation(fileInfo, updateInfo);
      } else {
        Dialog.create({
          title: 'Update Failed',
          message:
            'Failed to download or prepare the APK. Please try again later.',
          ok: 'OK',
        });
      }
    }
  }

  private async launchInstaller(
    fileInfo: { uri: string },
    updateInfo: UpdateInfo
  ): Promise<void> {
    try {
      Loading.show({
        spinner: QSpinnerDots,
        message: 'Installing APK...',
      });

      // Open the APK file to trigger installation
      await FileOpener.open({
        filePath: fileInfo.uri,
        contentType: 'application/vnd.android.package-archive',
      });

      Loading.hide();

      Dialog.create({
        title: 'APK Installation',
        message:
          'The APK installation has been initiated. Please follow the system prompts to complete the installation.',
        ok: 'OK',
      }).onOk(async () => {
        // Update the local version after successful installation initiation
        this.offerRetryInstallation(fileInfo, updateInfo);
      });
    } catch (error) {
      Loading.hide();
      console.error('Failed to launch installer:', error);
      this.offerRetryInstallation(fileInfo, updateInfo);
    }
  }

  private offerRetryInstallation(
    fileInfo: { uri: string },
    updateInfo: UpdateInfo
  ): void {
    Dialog.create({
      title: 'Installation Failed',
      message: 'The APK installation failed. Would you like to try again?',
      ok: 'Retry',
      cancel: 'Cancel',
    }).onOk(() => {
      this.launchInstaller(fileInfo, updateInfo);
    });
  }
}

export default new ApkUpdater();
