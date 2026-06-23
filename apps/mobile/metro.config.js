// Monorepo-aware Metro config.
// Lets the app resolve the workspace `@mahal/shared` package (TS source) and
// dependencies hoisted to the workspace-root node_modules by pnpm.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so changes in packages/shared trigger reloads.
config.watchFolders = [workspaceRoot];

// Resolve modules from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Disable package "exports" resolution. Expo SDK 54 defaults this to true, but
// it disables directory-index resolution for packages that declare an "exports"
// map, which breaks @clerk/clerk-expo's internal `require('./dummy-data')`.
config.resolver.unstable_enablePackageExports = false;

// NativeWind: compiles global.css (Tailwind) into RN styles at bundle time.
module.exports = withNativeWind(config, { input: './src/global.css' });
