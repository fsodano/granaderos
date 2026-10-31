import type { ReactNode } from 'react';
import { present } from './assert-present.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Capture host handlers inside a real React render, so hook-using components
// retain the same hook dispatcher as the game instead of being called standalone.
export function componentTree<Props, Tree extends ReactNode>(
  Component: (props: Props) => Tree,
  props: Props,
): Tree {
  let captured: { tree: Tree } | undefined;
  function Capture() {
    captured = { tree: Component(props) };
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  return present(captured).tree;
}
