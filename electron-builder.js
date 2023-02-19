/** @type {import('electron-builder').Configuration} */
const CONFIG = {
  directories: {
    output: "dist/package",
  },
  files: ["dist/src", "dist/main", "dist/preload", "dist/assets"],
  // https://www.electron.build/configuration/appimage
  linux: {
    target: "AppImage",
  },
  appImage: {
    desktop: {
      Name: "Electron Vite Template",
    },
  },
};

module.exports = CONFIG;
