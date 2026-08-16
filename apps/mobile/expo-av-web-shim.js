function noop() {}

module.exports = {
  Audio: {
    Mode: {},
    setAudioModeAsync: async function setAudioModeAsync() {},
    Recording: function Recording() {},
  },
  Video: function Video() {
    return null;
  },
  ResizeMode: {},
  useAudioRecorder: function useAudioRecorder() {
    return {};
  },
  useVideoPlayer: function useVideoPlayer() {
    return {};
  },
  AVPlaybackStatus: {},
  AudioMode: {},
  PitchCorrectionQuality: {},
  setAudioModeAsync: async function setAudioModeAsync() {},
  unloadAsync: async function unloadAsync() {},
  loadAsync: async function loadAsync() {},
  stopAndUnloadAsync: async function stopAndUnloadAsync() {},
  createAsync: async function createAsync() {
    return {};
  },
  Recording: function Recording() {},
  Sound: function Sound() {},
  setIsAudioEnabledAsync: async function setIsAudioEnabledAsync() {},
  getStatusAsync: async function getStatusAsync() {
    return {};
  },
  pauseAsync: async function pauseAsync() {},
  playAsync: async function playAsync() {},
  replayAsync: async function replayAsync() {},
  stopAsync: async function stopAsync() {},
  getURI: function getURI() {
    return null;
  },
  createThrottledUpdater: noop,
};
