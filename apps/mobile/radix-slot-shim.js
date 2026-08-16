const React = require("react");

function Slot(props) {
  return React.createElement(React.Fragment, null, props.children);
}

module.exports = {
  Slot: Slot,
};
