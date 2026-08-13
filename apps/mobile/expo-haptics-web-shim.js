function noop() {}

module.exports = {
  selectionAsync: async function selectionAsync() {},
  impactAsync: async function impactAsync() {},
  notificationAsync: async function notificationAsync() {},
  performAndroidHapticsAsync: async function performAndroidHapticsAsync() {},
  isAvailableAsync: async function isAvailableAsync() {
    return false;
  },
  Haptics: {
    selectionAsync: async function selectionAsync() {},
    impactAsync: async function impactAsync() {},
    notificationAsync: async function notificationAsync() {},
    performAndroidHapticsAsync: async function performAndroidHapticsAsync() {},
    isAvailableAsync: async function isAvailableAsync() {
      return false;
    },
  },
  ImpactFeedbackStyle: {},
  NotificationFeedbackType: {},
  AndroidHaptics: {},
  prepare: noop,
};
