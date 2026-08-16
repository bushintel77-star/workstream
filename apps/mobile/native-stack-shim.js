const React = require("react");

function Screen(props) {
  return React.createElement(React.Fragment, null, props.children);
}

function Group(props) {
  return React.createElement(React.Fragment, null, props.children);
}

function Navigator(props) {
  return React.createElement(React.Fragment, null, props.children);
}

function createNativeStackNavigator() {
  return {
    Navigator: Navigator,
    Screen: Screen,
    Group: Group,
  };
}

function NativeStackView(props) {
  return React.createElement(React.Fragment, null, props.children);
}

module.exports = {
  createNativeStackNavigator: createNativeStackNavigator,
  NativeStackView: NativeStackView,
};
