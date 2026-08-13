const React = require("react");

function getHeaderTitle(options, fallback) {
  return options && options.title ? options.title : fallback;
}

function Header(props) {
  return React.createElement(React.Fragment, null, props.children);
}

function SafeAreaProviderCompat(props) {
  return React.createElement(React.Fragment, null, props.children);
}

function Screen(props) {
  return React.createElement(React.Fragment, null, props.children);
}

module.exports = {
  getHeaderTitle: getHeaderTitle,
  Header: Header,
  SafeAreaProviderCompat: SafeAreaProviderCompat,
  Screen: Screen,
};
