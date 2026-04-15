const patchWebStorage = () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    if (!descriptor?.configurable) {
      continue;
    }

    Object.defineProperty(globalThis, key, {
      configurable: true,
      enumerable: descriptor.enumerable,
      value: undefined,
      writable: true,
    });
  }
};

patchWebStorage();

const NodeEnvironmentModule = require('jest-environment-node');
const NodeEnvironment = NodeEnvironmentModule.TestEnvironment ?? NodeEnvironmentModule.default;

module.exports = NodeEnvironment;
