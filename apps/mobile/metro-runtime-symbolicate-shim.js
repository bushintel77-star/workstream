function parseErrorStack(error) {
  return error && error.stack ? [] : [];
}

function LogBoxLog() {
  return null;
}

module.exports = {
  parseErrorStack: parseErrorStack,
  LogBoxLog: LogBoxLog,
};
