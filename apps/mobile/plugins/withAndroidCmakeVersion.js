// Expo config plugin: pins the CMake version used for the app's native (C++) build.
//
// Why: on Windows, React Native's autolinked C++ codegen produces object-file paths longer
// than 260 characters. The Android Gradle Plugin defaults to CMake 3.22.1, whose bundled
// ninja (1.10.2) cannot handle long paths and fails with "Filename longer than 260
// characters". CMake 3.31.6 bundles ninja 1.12.1, which supports long paths when Windows
// long-path support is enabled (LongPathsEnabled=1). See README "Android build on Windows".
//
// The version is written into android/app/build.gradle during `expo prebuild`, so it
// survives regenerating the native project.
const { withAppBuildGradle } = require('expo/config-plugins');

const DEFAULT_CMAKE_VERSION = '3.31.6';
const MARKER = '// @generated withAndroidCmakeVersion';

/** @type {import('expo/config-plugins').ConfigPlugin<{ version?: string } | void>} */
module.exports = function withAndroidCmakeVersion(config, props) {
  const version = (props && props.version) || DEFAULT_CMAKE_VERSION;
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withAndroidCmakeVersion: only Groovy build.gradle files are supported');
    }
    const block = `    ${MARKER}\n    externalNativeBuild {\n        cmake {\n            version "${version}"\n        }\n    }\n`;
    let contents = cfg.modResults.contents;
    // Replace a previously generated block (e.g. when the version changes) or insert a new one.
    const existing = new RegExp(
      `    ${MARKER}\\n    externalNativeBuild \\{[\\s\\S]*?\\n    \\}\\n`,
    );
    if (existing.test(contents)) {
      contents = contents.replace(existing, block);
    } else if (/^android \{\n/m.test(contents)) {
      contents = contents.replace(/^android \{\n/m, `android {\n${block}\n`);
    } else {
      throw new Error('withAndroidCmakeVersion: could not find the android { } block');
    }
    cfg.modResults.contents = contents;
    return cfg;
  });
};
