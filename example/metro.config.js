const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the parent directory for library source changes
config.watchFolders = [monorepoRoot];

// Block root node_modules and docs from Metro resolution.
// The library is symlinked via file:.. — when Metro follows the symlink
// into the root, it must NOT resolve deps from root/node_modules
// (which has different versions than example/node_modules).
config.resolver.blockList = [
  new RegExp(path.resolve(monorepoRoot, 'node_modules').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(monorepoRoot, 'docs').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
];

// Resolve ALL modules from example/node_modules only.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = config;
