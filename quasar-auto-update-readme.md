# Quasar Android App Documentation

## Table of Contents
1. [Auto-Update System](#auto-update-system)
2. [Building and Configuration](#building-and-configuration)
3. [Core Files](#core-files)
4. [Version Management](#version-management)
5. [App Customization](#app-customization)

## Auto-Update System

The app supports two types of updates:
- Web Assets Updates (HTML, CSS, JS) using Capgo
- Full APK Updates

### Required Dependencies

```bash
npm install @capgo/capacitor-updater @capgo/cli @capacitor/core @capacitor/filesystem @capacitor-community/file-opener @capacitor/android
```

### 1. Web Assets Update Configuration

#### Step 1: Install Capgo
```bash
npm install @capgo/capacitor-updater @capgo/cli
npx cap sync
```

#### Step 2: Configure Capacitor
Create or update `capacitor.config.js`:

```javascript
{
  "appId": "com.package.app",
  "appName": "package name",
  "webDir": "www",
  "plugins": {
    "Geolocation": {
      "android": {
        "locationProvider": "network"
      }
    },
    "Camera": {
      "photoQuality": "high",
      "saveToGallery": true
    },
    "Filesystem": {},
    "FileOpener": {},
    "CapacitorUpdater": {
      "autoUpdate": false
    },
    "SplashScreen": {
      "launchShowDuration": 3000,
      "launchAutoHide": true,
      "backgroundColor": "#001b2b",
      "androidSplashResourceName": "splash",
      "androidScaleType": "CENTER_CROP",
      "showSpinner": true,
      "androidSpinnerStyle": "large",
      "iosSpinnerStyle": "small",
      "spinnerColor": "#ffffff",
      "splashFullScreen": true,
      "splashImmersive": true
    },
    "appSettings": {
      "android": {
        "webView": {
          "allowFileAccess": true,
          "allowFileAccessFromFileURLs": true,
          "allowUniversalAccessFromFileURLs": true,
          "cookieEnabled": true,
          "databaseEnabled": true,
          "domStorageEnabled": true
        }
      }
    }
  }
}
```

#### Step 3: Create Update Package Structure
```
update.zip
└── public
    └── (spa files: index.html, js, css, etc.)
```

#### Step 4: Upload Update
```bash
npx @capgo/cli bundle upload --external=https://yoururl.com/apk/update.zip --version 1.0.6
```

### 2. APK Update Configuration

#### Step 1: Install Required Packages
```bash
npm install @capacitor/core@latest @capacitor/filesystem @capacitor-community/file-opener
npx cap sync
```

#### Step 2: Configure File Paths
Create `src-capacitor/android/app/src/main/res/xml/file_paths.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <external-path name="my_images" path="." />
    <cache-path name="my_cache_images" path="." />
    <cache-path name="apk_downloads" path="/" />
</paths>
```

#### Step 3: Update AndroidManifest.xml
Add to your manifest:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
  xmlns:tools="http://schemas.android.com/tools">

  <uses-feature
    android:name="android.hardware.camera"
    android:required="false" />

  <application
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:supportsRtl="true"
    android:theme="@style/AppTheme"
    android:usesCleartextTraffic="true"
    android:requestLegacyExternalStorage="true">

    <activity
      android:name=".MainActivity"
      android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
      android:exported="true"
      android:label="@string/title_activity_main"
      android:launchMode="singleTask"
      android:theme="@style/AppTheme.NoActionBarLaunch">

      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>

    </activity>

    <provider
      android:name="androidx.core.content.FileProvider"
      android:authorities="${applicationId}.fileprovider"
      android:exported="false"
      android:grantUriPermissions="true">
      <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
    </provider>

  </application>

  <!-- Permissions -->
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-permission android:name="android.permission.RECORD_AUDIO" />
  <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />

  <queries>
    <intent>
      <action android:name="android.intent.action.VIEW" />
      <data android:mimeType="application/vnd.android.package-archive" />
    </intent>
  </queries>

</manifest>
```

#### Step 4: Create MainActivity.java
Create or update `src-capacitor/android/app/src/main/java/com/package/app/MainActivity.java`:

```java
package com.package.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
  private static final int PERMISSION_REQUEST_CODE = 123;

  private String[] permissions = {
    Manifest.permission.CAMERA,
    Manifest.permission.RECORD_AUDIO,
    Manifest.permission.READ_EXTERNAL_STORAGE,
    Manifest.permission.WRITE_EXTERNAL_STORAGE,
    Manifest.permission.ACCESS_FINE_LOCATION,
    Manifest.permission.ACCESS_COARSE_LOCATION
  };

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Set WebView settings for cookies and local storage
    WebView webView = new WebView(this);
    WebSettings webSettings = webView.getSettings();
    webSettings.setDomStorageEnabled(true); // Enable DOM storage

    // Enable cookies
    CookieManager cookieManager = CookieManager.getInstance();
    cookieManager.setAcceptCookie(true);
    cookieManager.setAcceptThirdPartyCookies(webView, true);

    // Check and request permissions
    checkAndRequestPermissions();
  }

  private void checkAndRequestPermissions() {
    List<String> permissionsToRequest = new ArrayList<>();

    for (String permission : permissions) {
      if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
        permissionsToRequest.add(permission);
      }
    }

    if (!permissionsToRequest.isEmpty()) {
      ActivityCompat.requestPermissions(this, permissionsToRequest.toArray(new String[0]), PERMISSION_REQUEST_CODE);
    }
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode == PERMISSION_REQUEST_CODE) {
      for (int i = 0; i < permissions.length; i++) {
        if (grantResults[i] == PackageManager.PERMISSION_GRANTED) {
          Log.d("Permissions", permissions[i] + " granted");
        } else {
          Log.d("Permissions", permissions[i] + " denied");
          // Handle denied permission
        }
      }
    }
  }
}
```

## Building and Configuration

### Build Process

1. Build Quasar project:
```bash
quasar build -m capacitor -T android
```

2. Navigate to Capacitor directory:
```bash
cd src-capacitor
```

3. Sync Capacitor:
```bash
npx cap sync
```

## Version Management

### Update Version Numbers

1. In Android Studio, update `build.gradle (Module :app)`:
```gradle
android {
    defaultConfig {
        versionCode 4      // Increment for each update
        versionName "1.0.4" // Update version string
    }
}
```

2. Update `quasar.config.js`:
```javascript
module.exports = function (ctx) {
  return {
    // ... other config
    env: {
      APP_VERSION: JSON.stringify(require('./package.json').version).replace(
        /^"(.*)"$/,
        '$1'
      ),
    },
  }
}
```

3. Update version in `package.json`.

### Implement Updater

In `app.vue`:
```javascript
import Updater from './composables/updater';

export default {
  setup() {
    onMounted(async () => {
      try {
        await Updater.initialize();
        watchPosition();
      } catch (error) {
        console.error('Failed to initialize updater:', error);
      }
    });
  }
}
```

## App Customization

### Generate Icons and Splash Screens
```bash
icongenie g -m capacitor -i public/icons/icon.png --quality 12 --splashscreen-color #001b2b
```

### Configure App Icon

1. Place your icon at `public/icons/icon.png`
2. Run the icongenie command above to generate all required sizes
3. The icons will be automatically placed in the correct Android directories

## Important Notes

1. Always update both the APK version code and package.json version when releasing updates
2. Test the update mechanism in a staging environment first
3. Keep your update.zip file structure consistent
4. Ensure all permissions are properly configured in AndroidManifest.xml
5. Test the app on multiple Android versions to ensure compatibility



[← Back to main documentation](README.md)

