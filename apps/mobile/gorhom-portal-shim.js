const React = require("react");

function PortalProvider(props) {
  return React.createElement(React.Fragment, null, props.children);
}

function Portal(props) {
  return React.createElement(React.Fragment, null, props.children);
}

module.exports = {
  PortalProvider: PortalProvider,
  Portal: Portal,
};
