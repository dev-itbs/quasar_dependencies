# Quasar Build Electron

[← Back to main documentation](README.md)

# Building an Electron Application with Quasar Framework

## Initial Setup

1. First, install the required notarization package:
```bash
npm i electron-notarize
```

2. Add Electron mode to your Quasar project:
```bash
quasar mode add electron
```

## Notarization Setup

Create a file `script/notarize.js` with the following content:
```javascript
const { notarize } = require('electron-notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  return await notarize({
    appBundleId: 'com.peoplefirst.app',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
  });
};
```

## Main Process Configuration

Replace the content of `src-electron/electron-main.ts` with:
```typescript
import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import os from 'os';

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

let mainWindow: BrowserWindow | undefined;

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(__dirname, 'icons/icon.png'),
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      preload: path.resolve(__dirname, process.env.QUASAR_ELECTRON_PRELOAD),
    },
  });
  // Enable persistent cookies
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        'User-Agent': 'Chrome',
      },
    });
  });

  mainWindow.loadURL(process.env.APP_URL);

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools();
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === undefined) {
    createWindow();
  }
});
```

## Quasar Configuration

Add this electron configuration to your `quasar.config.ts`:
```typescript
electron: {
  inspectPort: 5858,
  bundler: 'builder',

  builder: {
    appId: 'com.ssdsmleyte.app',
    productName: 'SSDMS Leyte',
    mac: {
      target: 'dmg',
      icon: 'src-electron/icons/icon.icns',
      hardenedRuntime: true,
      gatekeeperAssess: false,
      entitlements: 'build/entitlements.mac.plist',
      entitlementsInherit: 'build/entitlements.mac.plist',
    },
    dmg: {
      contents: [
        {
          x: 130,
          y: 220,
        },
        {
          x: 410,
          y: 220,
          type: 'link',
          path: '/Applications',
        },
      ],
    },
    afterSign: 'scripts/notarize.js',
  },
  unPackagedInstallParams: [
    'install',
    '--production',
    '--ignore-optional',
    '--some-other-param',
  ],
}
```

## Cookie Configuration

### 1. Configure Axios Interceptor
In `src/boot/axios.ts`:
```typescript
api.interceptors.request.use((config) => {
  let token;

  if (process.env.MODE === 'electron') {
    token = localStorage.getItem(process.env.COOKIES_TOKEN_NAME || 'app_token');
  } else {
    token = Cookies.get(process.env.COOKIES_TOKEN_NAME || 'app_token');
  }

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  return config;
});
```

### 2. Configure Auth Store
In `src/stores/auth.store.ts`:
```typescript
if (process.env.MODE === 'electron') {
  localStorage.setItem(
    process.env.COOKIES_TOKEN_NAME || 'app_token',
    response.access_token
  );
} else {
  Cookies.set(
    process.env.COOKIES_TOKEN_NAME || 'app_token',
    response.access_token,
    options
  );
}
```

### 3. Add MODE to Environment Variables
In `quasar.config.ts`, add:
```typescript
env: {
  MODE: ctx.modeName
}
```

## Fixing Navigation Issues

To prevent white screens and navigation issues in the Electron app:

1. Replace `href` with `:to` in your components. For example, in `src/components/EssentialLink.vue`:
```vue
<!-- Instead of -->
<q-item clickable tag="a" href="link" @click="handleClick">

<!-- Use -->
<q-item clickable tag="a" :to="link" @click="handleClick">
```

2. In your routes, change paths from `/#/` to `/`

These changes ensure proper navigation within the Electron app context.
