// Shared Jest setup: replace native/font-dependent modules with light stand-ins.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  // Renders the icon name so it is visible to tests but never collides with real text queries.
  const Icon = ({ name }) => React.createElement(Text, { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' }, '');
  return { Feather: Icon, Ionicons: Icon };
});
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Home dashboard: animation, SVG and gradient are visual only, so tests use instant, plain stand-ins.
jest.mock('./src/motion', () => ({
  useReveal: () => 1,
  Reveal: ({ children }) => children,
  Pulse: () => null,
}));
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stub = ({ children }) => React.createElement(View, null, children);
  return { __esModule: true, default: Stub, Svg: Stub, Circle: Stub };
});
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: ({ children, style }) => React.createElement(View, { style }, children) };
});
