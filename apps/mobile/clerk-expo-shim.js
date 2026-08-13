const React = require("react");

function noop() {}

function makeAuthShape() {
  return {
    isLoaded: true,
    isSignedIn: true,
    signOut: async function signOut() {},
    getToken: async function getToken() {
      return null;
    },
  };
}

function ClerkProvider(props) {
  return React.createElement(React.Fragment, null, props.children);
}

function ClerkLoaded(props) {
  return React.createElement(React.Fragment, null, props.children);
}

function useAuth() {
  return makeAuthShape();
}

function useSignIn() {
  return {
    isLoaded: true,
    signIn: {
      create: async function create() {
        return {};
      },
    },
    setActive: async function setActive() {},
  };
}

function useSignUp() {
  return {
    isLoaded: true,
    signUp: {
      create: async function create() {
        return {};
      },
    },
    setActive: async function setActive() {},
  };
}

function isClerkAPIResponseError() {
  return false;
}

module.exports = {
  ClerkProvider: ClerkProvider,
  ClerkLoaded: ClerkLoaded,
  useAuth: useAuth,
  useSignIn: useSignIn,
  useSignUp: useSignUp,
  isClerkAPIResponseError: isClerkAPIResponseError,
  SignIn: noop,
  SignUp: noop,
};
