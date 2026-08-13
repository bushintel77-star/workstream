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

function createBottomTabNavigator() {
  return {
    Navigator: Navigator,
    Screen: Screen,
    Group: Group,
  };
}

module.exports = {
  createBottomTabNavigator: createBottomTabNavigator,
  BottomTabBar: function BottomTabBar() {
    return null;
  },
  BottomTabNavigationEventMap: {},
  BottomTabNavigationState: {},
  BottomTabBarButton: function BottomTabBarButton(props) {
    return React.createElement(React.Fragment, null, props.children);
  },
};
