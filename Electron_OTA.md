# Electron OTA Updates Implementation Guide for DICT R8 Kiosk

This guide explains how to implement and manage over-the-air (OTA) updates for the DICT R8 Kiosk Electron application. It covers both the built-in Electron updater and the custom release publishing mechanism.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Implementation Details](#implementation-details)
  - [Auto-updater Configuration](#auto-updater-configuration)
  - [Update Process in the Application](#update-process-in-the-application)
  - [Custom Release Publishing](#custom-release-publishing)
- [Usage](#usage)
  - [Standard Method](#standard-method)
  - [Custom Release Method](#custom-release-method)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## Overview

The DICT R8 Kiosk application uses Electron's `electron-updater` package for automatic updates. This allows the application to check for, download, and install updates without requiring manual intervention from users. Additionally, a custom release publishing script has been implemented to bypass some limitations of the standard Electron release process.

## Prerequisites

- GitHub repository for releases (`dev-itbs/DICT-R8-KIOSK-RELEASES`)
- GitHub Personal Access Token with repo permissions
- Node.js v16+
- Quasar CLI

## Implementation Details

### Auto-updater Configuration

The auto-updater is configured in `quasar.config.js` under the electron section:

```javascript
electron: {
  // ...
  publish: [
    {
      provider: "github",
      owner: "dev-itbs",
      repo: "DICT-R8-KIOSK-RELEASES",
      private: false,
      vPrefixedTagName: true,
    },
  ],
}
```

### Required Code Implementation

#### Main Process (`electron-main.js`)

The main process handles the auto-updater events and IPC communication:

```javascript
import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";

// Configure logging
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

// Explicitly set feed URL
autoUpdater.setFeedURL({
  provider: "github",
  owner: "dev-itbs",
  repo: "DICT-R8-KIOSK-RELEASES",
  private: false,
});

// Disable auto downloading to give user control
autoUpdater.autoDownload = false;

// Function to check for updates
export function checkForUpdates() {
  autoUpdater.checkForUpdatesAndNotify();
}

// Add event listeners for update events
autoUpdater.on("update-available", (info) => {
  // Send update info to renderer process
  if (mainWindow) {
    mainWindow.webContents.send("update-available", info);
  }
});

autoUpdater.on("update-not-available", (info) => {
  if (mainWindow) {
    mainWindow.webContents.send("update-not-available", info);
  }
});

autoUpdater.on("error", (err) => {
  console.error("Application Update error:", err);
  if (mainWindow) {
    mainWindow.webContents.send("update-error", err);
  }
});

autoUpdater.on("download-progress", (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send("download-progress", progressObj);
  }
});

autoUpdater.on("update-downloaded", (info) => {
  if (mainWindow) {
    mainWindow.webContents.send("update-downloaded", info);
  }
});

// Listen for renderer process events
ipcMain.on("check-for-updates", () => {
  checkForUpdates();
});

ipcMain.on("download-update", () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on("install-update", () => {
  autoUpdater.quitAndInstall(false, true);
});

// Check for updates after app is ready
app.whenReady().then(() => {
  createWindow();
  // Optional: Automatically check for updates on startup
  // setTimeout(checkForUpdates, 3000);
});
```

#### Preload Script (`electron-preload.js`)

The preload script safely exposes IPC functions to the renderer process:

```javascript
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  ipcRenderer: {
    send: (channel, data) => {
      // Whitelist channels
      const validChannels = [
        "check-for-updates",
        "download-update",
        "install-update",
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    on: (channel, func) => {
      const validChannels = [
        "update-available",
        "update-not-available",
        "update-error",
        "download-progress",
        "update-downloaded",
      ];
      if (validChannels.includes(channel)) {
        // Strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
  },
});
```

#### UI Component (`ElectronUpdater.vue`)

This Vue component provides the user interface for update interactions:

```vue
<template>
  <div v-if="updateAvailable || updateDownloaded || downloadProgress > 0">
    <q-banner dense class="bg-primary text-white q-mb-md">
      <template v-if="updateAvailable && !updateDownloaded">
        <div class="text-h6">Update Available</div>
        <p>Version {{ updateInfo.version }} is available.</p>
        <q-btn
          color="white"
          text-color="primary"
          label="Download"
          @click="downloadUpdate"
          v-if="!downloading"
        />
        <div v-else>
          <q-progress :value="downloadProgress" />
          <div class="text-subtitle2">
            Downloading: {{ Math.round(downloadProgress) }}%
          </div>
        </div>
      </template>

      <template v-if="updateDownloaded">
        <div class="text-h6">Update Ready</div>
        <p>Update has been downloaded. Restart to install.</p>
        <q-btn
          color="white"
          text-color="primary"
          label="Restart Now"
          @click="installUpdate"
        />
      </template>
    </q-banner>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useQuasar } from "quasar";

const $q = useQuasar();
const updateAvailable = ref(false);
const updateDownloaded = ref(false);
const downloading = ref(false);
const downloadProgress = ref(0);
const updateInfo = ref({});

// Check if we're running in Electron
const isElectron = ref(!!window.electronAPI);

const checkForUpdates = () => {
  if (isElectron.value) {
    window.electronAPI.ipcRenderer.send("check-for-updates");
  }
};

const downloadUpdate = () => {
  downloading.value = true;
  window.electronAPI.ipcRenderer.send("download-update");
};

const installUpdate = () => {
  window.electronAPI.ipcRenderer.send("install-update");
};

onMounted(() => {
  if (isElectron.value) {
    // Setup listeners for Electron IPC events
    window.electronAPI.ipcRenderer.on("update-available", (info) => {
      console.log("Update available event received:", info);
      updateAvailable.value = true;
      updateInfo.value = info;
      $q.notify({
        type: "positive",
        message: `New update v${info.version} available!`,
        position: "top",
        timeout: 0,
      });
    });

    window.electronAPI.ipcRenderer.on("update-not-available", () => {
      updateAvailable.value = false;
      $q.notify({
        type: "info",
        message: "No updates available. You have the latest version.",
        position: "top",
      });
    });

    window.electronAPI.ipcRenderer.on("update-error", (err) => {
      $q.notify({
        type: "negative",
        message: `Update error: ${err.message}`,
        position: "top",
      });
      console.error("Update error:", err);
    });

    window.electronAPI.ipcRenderer.on("download-progress", (progressObj) => {
      downloadProgress.value = progressObj.percent || 0;
    });

    window.electronAPI.ipcRenderer.on("update-downloaded", () => {
      updateDownloaded.value = true;
      downloading.value = false;
      $q.notify({
        type: "positive",
        message: "Update downloaded and ready to install!",
        position: "top",
      });
    });

    // Check for updates when component mounts
    setTimeout(() => {
      checkForUpdates();
    }, 3000);
  }
});

onUnmounted(() => {
  // No explicit cleanup needed with the setup syntax
  // Vue's reactivity system handles this automatically
});
</script>
```

### Using the Update Component

To use the ElectronUpdater component in your application, import and include it in your main App component or layout:

```vue
<template>
  <div>
    <!-- Include the updater component -->
    <ElectronUpdater />

    <!-- Rest of your application -->
    <router-view />
  </div>
</template>

<script setup>
import ElectronUpdater from "components/ElectronUpdater.vue";
</script>
```

### Update Process in the Application

The update process is managed through IPC (Inter-Process Communication) between the main and renderer processes:

1. The application checks for updates either automatically on startup or when triggered by the user
2. If an update is available, the user is notified with the option to download it
3. The download progress is displayed to the user
4. Once downloaded, the user is prompted to restart the application to install the update
5. When the user confirms, the application restarts and the update is installed

### Custom Release Publishing

The custom release publishing script (`publish-release.js`) bypasses the standard Electron builder release process. This is useful when:

- The release repository is different from the main repository
- More control over the release process is needed
- Custom build artifacts need to be included

The script:

1. Builds the Electron application
2. Creates a new GitHub release based on the package version
3. Uploads all build artifacts to the release

Here's the complete implementation of the custom release publishing script:

```javascript
// publish-release.js
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { createReadStream } = require("fs");

// Configuration
const config = {
  owner: "dev-itbs",
  repo: "DICT-R8-KIOSK-RELEASES",
  token: process.env.GH_TOKEN || "", // Make sure you have GH_TOKEN set in environment
  buildDir: path.join(__dirname, "dist/electron/Packaged"), // Adjust based on your build output directory
};

// GitHub API helper functions
function makeGitHubRequest(
  method,
  endpoint,
  data = null,
  contentType = "application/json"
) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: endpoint,
      method: method,
      headers: {
        "User-Agent": "DICT-R8-Kiosk-Release-Script",
        Authorization: `token ${config.token}`,
        Accept: "application/vnd.github.v3+json",
      },
    };

    if (data && contentType === "application/json") {
      options.headers["Content-Type"] = contentType;
      if (typeof data === "object") {
        data = JSON.stringify(data);
      }
      options.headers["Content-Length"] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (e) {
            resolve(responseData);
          }
        } else {
          console.error(`GitHub API Error (${res.statusCode}):`, responseData);
          reject(
            new Error(
              `GitHub API request failed with status ${res.statusCode}: ${responseData}`
            )
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

// Upload release asset
function uploadReleaseAsset(releaseId, filePath, fileName) {
  return new Promise((resolve, reject) => {
    const fileSize = fs.statSync(filePath).size;
    const fileStream = fs.createReadStream(filePath);

    const options = {
      hostname: "uploads.github.com",
      path: `/repos/${config.owner}/${
        config.repo
      }/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`,
      method: "POST",
      headers: {
        "User-Agent": "DICT-R8-Kiosk-Release-Script",
        Authorization: `token ${config.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/octet-stream",
        "Content-Length": fileSize,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (e) {
            resolve(responseData);
          }
        } else {
          console.error(`GitHub API Error (${res.statusCode}):`, responseData);
          reject(
            new Error(
              `GitHub API request failed with status ${res.statusCode}: ${responseData}`
            )
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    fileStream.pipe(req);

    fileStream.on("error", (error) => {
      reject(error);
    });
  });
}

async function publishRelease() {
  console.log("Starting custom release process...");

  // Verify token
  if (!config.token) {
    console.error(
      "Error: GitHub token not found. Set GH_TOKEN environment variable."
    );
    process.exit(1);
  }

  // Build the application first
  console.log("Building Electron application...");
  try {
    execSync("quasar build -m electron", { stdio: "inherit" });
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }

  // Check if the build directory exists
  if (!fs.existsSync(config.buildDir)) {
    console.error(`Build directory not found: ${config.buildDir}`);
    console.log(
      "Please check your build configuration and update the buildDir path in the script."
    );
    process.exit(1);
  }

  // Find built artifacts
  console.log("Looking for build artifacts...");
  const files = fs
    .readdirSync(config.buildDir)
    .filter(
      (file) =>
        file.endsWith(".exe") ||
        file.endsWith(".dmg") ||
        file.endsWith(".AppImage") ||
        file.endsWith(".deb") ||
        file.endsWith(".blockmap") ||
        file.endsWith(".yml")
    );

  if (files.length === 0) {
    console.error("No build artifacts found in", config.buildDir);
    process.exit(1);
  }

  console.log("Found artifacts:", files);

  // Get package version for release tag
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "package.json"), "utf8")
  );
  const version = packageJson.version;
  const tagName = `v${version}`;

  // Create a new release
  console.log(`Creating release ${tagName}...`);
  let release;
  try {
    release = await makeGitHubRequest(
      "POST",
      `/repos/${config.owner}/${config.repo}/releases`,
      {
        tag_name: tagName,
        name: `${version}`,
        body: `DICT R8 Kiosk Release ${version}`,
        draft: true,
        prerelease: false,
      }
    );
    console.log("Release created:", release.html_url);
  } catch (error) {
    console.error("Failed to create release:", error.message);
    process.exit(1);
  }

  // Upload each artifact
  for (const file of files) {
    const filePath = path.join(config.buildDir, file);

    console.log(`Uploading ${file}...`);
    try {
      const asset = await uploadReleaseAsset(release.id, filePath, file);
      console.log(`Uploaded ${file}:`, asset.browser_download_url);
    } catch (error) {
      console.error(`Failed to upload ${file}:`, error.message);
    }
  }

  console.log("Release process completed successfully!");
}

publishRelease().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
```

Add this as a script in your `package.json`:

```json
"scripts": {
  "publish-release": "node publish-release.js"
}
```

## Usage

### Standard Method

To build and publish using the standard Electron builder method:

```bash
# Build and publish to the configured repository
quasar build -m electron -P
```

This will build the app and publish the release according to the `publish` configuration in `quasar.config.js`.

### Custom Release Method

To use the custom release publishing script:

1. Set your GitHub token as an environment variable:

```bash
# Linux/macOS
export GH_TOKEN=your_github_token

# Windows
set GH_TOKEN=your_github_token
```

2. Run the publish-release script:

```bash
npm run publish-release
```

This will:

- Build the application using `quasar build -m electron`
- Create a new release in the `dev-itbs/DICT-R8-KIOSK-RELEASES` repository
- Upload all build artifacts to the release

## Troubleshooting

### Common Issues

1. **Authentication Errors**:

   - Make sure your GitHub token is correctly set and has repo permissions
   - Check that the token hasn't expired

2. **Release Artifacts Not Found**:

   - Verify the build directory path in `publish-release.js` (`config.buildDir`)
   - Make sure the build completed successfully

3. **Updates Not Detecting**:

   - Check that the version in `package.json` is incremented
   - Ensure the auto-updater is properly configured with the correct repo information
   - Verify the application is properly signed (especially on macOS)

4. **"ENOENT" Errors**:
   - Check file paths in the publish script
   - Make sure all required directories exist

## Security Considerations

1. **GitHub Token**: Never commit your GitHub token to version control. Use environment variables or secure storage.

2. **Code Signing**: For production releases, always sign your application:

   - Windows: Use a code signing certificate
   - macOS: Use Apple Developer ID and notarization

3. **Update Validation**: Electron-updater validates the authenticity of updates by default using GitHub's HTTPS

4. **Sensitive Information**: Review your code and build artifacts to ensure no sensitive information is included in releases

---

This guide provides an overview of implementing OTA updates in the DICT R8 Kiosk application. For more detailed information about Electron updates, refer to the [electron-updater documentation](https://www.electron.build/auto-update.html).

## Additional Information

### Available Options for `-P` (`--publish`)

The `-P` flag controls whether or not Quasar should automatically publish the build artifacts (such as `.exe`, `.dmg`, `.AppImage`, etc.) after building the Electron app.

| Option         | Description                                                       |
| -------------- | ----------------------------------------------------------------- |
| `always`       | Always publish the build artifacts, even if there are no changes. |
| `onTag`        | Publish only when a Git tag is present.                           |
| `onTagOrDraft` | Publish when a Git tag or a GitHub draft release exists.          |
| `never`        | Never publish the artifacts automatically.                        |

### Complete Variables for GitHub Provider (`provider: "github"`)

These variables are used inside `package.json` (`build.publish`) or `electron-builder.json`.

| Variable           | Type    | Description                                                                                 |
| ------------------ | ------- | ------------------------------------------------------------------------------------------- |
| `provider`         | string  | Must be `"github"` for GitHub releases.                                                     |
| `owner`            | string  | GitHub account or organization that owns the repository.                                    |
| `repo`             | string  | Name of the GitHub repository where releases are stored.                                    |
| `private`          | boolean | Set to `true` for private repositories, `false` for public ones.                            |
| `releaseType`      | string  | (Optional) Type of GitHub release: `"draft"`, `"prerelease"`, or `"release"`.               |
| `token`            | string  | (Optional) GitHub personal access token (needed for private repos or CI/CD automation).     |
| `host`             | string  | (Optional) Custom GitHub Enterprise domain (e.g., `"https://github.company.com/api"`).      |
| `protocol`         | string  | (Optional) Custom protocol (default is `"https"`).                                          |
| `vPrefixedTagName` | boolean | (Optional) Whether the version tag should have a `"v"` prefix (e.g., `v1.0.0` vs. `1.0.0`). |

### Other Provider Options

Besides GitHub, electron-builder supports several other publish providers:

1. **S3 (`provider: "s3"`)**: Publish to Amazon S3

   - Requires configuration of `bucket`, `region`, `endpoint`, etc.

2. **Spaces (`provider: "spaces"`)**: Publish to DigitalOcean Spaces

   - Similar to S3 but with DO-specific parameters

3. **Generic (`provider: "generic"`)**: Publish to any HTTP server

   - Requires `url` to specify the server endpoint
   - Useful for self-hosted update servers

4. **Snap Store (`provider: "snapStore"`)**: Publish to the Ubuntu Snap Store

   - Requires `snap` configuration

5. **Bintray (`provider: "bintray"`)**: Publish to JFrog Bintray
   - Note: Bintray service has been discontinued, included for reference only

For detailed configuration of these providers, refer to the [electron-builder documentation](https://www.electron.build/electron-publish.class.publisher).
