import {createElement} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';

// Capture host handlers inside a real React render, so hook-using components
// retain the same hook dispatcher as the game instead of being called standalone.
export function componentTree(Component, props) {
  let tree;
  function Capture() { tree = Component(props); return null; }
  renderToStaticMarkup(createElement(Capture));
  return tree;
}
