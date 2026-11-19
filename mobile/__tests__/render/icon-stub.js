/* Every per-icon module of phosphor-react-native (src/icons/*.tsx), as one stand-in: a View that
 * carries the icon's accessible title, so icons render without react-native-svg's native views. */
const React = require("react");
const { View } = require("react-native");

const icons = new Map();
function icon(name) {
  if (!icons.has(name)) {
    const Icon = React.forwardRef(({ title, size, testID }, ref) => React.createElement(View, { ref, testID, accessibilityLabel: title, style: { width: size, height: size } }));
    Icon.displayName = name;
    icons.set(name, Icon);
  }
  return icons.get(name);
}
module.exports = new Proxy({}, { get: (_, name) => (name === "__esModule" ? true : typeof name === "string" ? icon(name) : undefined) });
