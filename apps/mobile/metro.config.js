const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
  path.resolve(workspaceRoot, "packages/domain/node_modules"),
  path.resolve(workspaceRoot, "packages/ui/node_modules"),
  path.resolve(workspaceRoot, "packages/contracts/node_modules"),
  path.resolve(workspaceRoot, "packages/client/node_modules"),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.unstable_enableSymlinks = true;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@expo/metro-runtime/error-overlay") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "metro-runtime-error-overlay.js"),
    };
  }
  if (moduleName === "@expo/metro-runtime/symbolicate") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "metro-runtime-symbolicate-shim.js"),
    };
  }
  if (moduleName === "@expo/metro-runtime/src/error-overlay/Data/LogContext") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "metro-runtime-log-context-shim.js"),
    };
  }
  if (moduleName === "@expo/metro-runtime/src/error-overlay/overlay/LogBoxInspectorStackFrames") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "metro-runtime-stack-frames-shim.js"),
    };
  }
  if (moduleName === "react-refresh/runtime") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "react-refresh-runtime-shim.js"),
    };
  }
  if (moduleName === "@expo/metro/metro-runtime/modules/HMRClient") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "metro-hmr-client-shim.js"),
    };
  }
  if (moduleName === "pretty-format") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "pretty-format-web-shim.js"),
    };
  }
  if (moduleName === "@expo/log-box/src/LogBox") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "log-box-shim.js"),
    };
  }
  if (moduleName === "styleq/transform-localize-style") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "styleq-transform-localize-style.js"),
    };
  }
  if (platform === "web" && moduleName === "@clerk/clerk-expo") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "clerk-expo-shim.js"),
    };
  }
  if (platform === "web" && moduleName === "react-native-gesture-handler") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "gesture-handler-web-shim.js"),
    };
  }
  if (moduleName === "perfect-freehand") {
    return {
      type: "sourceFile",
      filePath: path.resolve(
        workspaceRoot,
        "packages/domain/node_modules/perfect-freehand/dist/cjs/index.js",
      ),
    };
  }
  if (platform === "web" && moduleName === "expo-av") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "expo-av-web-shim.js"),
    };
  }
  if (platform === "web" && moduleName === "expo-haptics") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "expo-haptics-web-shim.js"),
    };
  }
  if (moduleName === "react-is") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "node_modules/react-is/index.js"),
    };
  }
  if (moduleName === "decode-uri-component") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "node_modules/decode-uri-component/index.js"),
    };
  }
  if (moduleName === "filter-obj") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "node_modules/filter-obj/index.js"),
    };
  }
  if (moduleName === "split-on-first") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "node_modules/split-on-first/index.js"),
    };
  }
  if (moduleName === "merge-options") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "merge-options-web-shim.js"),
    };
  }
  if (moduleName === "@turf/turf") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "turf-web-shim.js"),
    };
  }
  if (moduleName === "css-in-js-utils") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "node_modules/css-in-js-utils/lib/index.js"),
    };
  }
  if (moduleName === "hyphenate-style-name") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "node_modules/hyphenate-style-name/index.js"),
    };
  }
  if (moduleName === "scheduler") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "node_modules/scheduler/index.js"),
    };
  }
  if (moduleName === "@radix-ui/react-slot") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "radix-slot-shim.js"),
    };
  }
  if (moduleName === "@radix-ui/react-compose-refs") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "radix-compose-refs-shim.js"),
    };
  }
  if (moduleName === "@react-navigation/elements") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "react-navigation-elements-shim.js"),
    };
  }
  if (moduleName === "@gorhom/portal") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "gorhom-portal-shim.js"),
    };
  }
  if (moduleName === "@react-navigation/bottom-tabs") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "bottom-tabs-shim.js"),
    };
  }
  if (moduleName === "@react-navigation/native-stack") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "native-stack-shim.js"),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
