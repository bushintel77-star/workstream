const React = require("react");

function createGesture() {
  const gesture = {
    enabled() {
      return gesture;
    },
    runOnJS() {
      return gesture;
    },
    onStart() {
      return gesture;
    },
    onUpdate() {
      return gesture;
    },
    onEnd() {
      return gesture;
    },
  };
  return gesture;
}

function GestureDetector(props) {
  return React.createElement(React.Fragment, null, props.children);
}

function GestureHandlerRootView(props) {
  return React.createElement(React.Fragment, null, props.children);
}

module.exports = {
  Gesture: {
    Pan: createGesture,
  },
  GestureDetector: GestureDetector,
  GestureHandlerRootView: GestureHandlerRootView,
};
