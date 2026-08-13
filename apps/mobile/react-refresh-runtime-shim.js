function noop() {}

module.exports = {
  injectIntoGlobalHook: noop,
  register: noop,
  createSignatureFunctionForTransform: function createSignatureFunctionForTransform() {
    return noop;
  },
  performReactRefresh: noop,
};
