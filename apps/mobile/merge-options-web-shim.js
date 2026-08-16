function mergeOptions() {
  const result = {};
  for (let i = 0; i < arguments.length; i += 1) {
    const value = arguments[i];
    if (value && typeof value === "object") {
      Object.assign(result, value);
    }
  }
  return result;
}

module.exports = mergeOptions;
