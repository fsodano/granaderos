/** @type {Map<string,Promise<boolean>>} */
const images = new Map();
/** @template {{name:string,href:string}} Sprite
 * @param {Sprite} requested
 * @param {Sprite|null} loaded
 * @param {string|undefined} readyHref
 * @returns {Sprite} */
export function spriteContinuity(requested, loaded, readyHref) {
  const sameLife =
    loaded &&
    ['dead', 'collapse', 'unconscious'].every(
      (condition) => loaded.name.includes(condition) === requested.name.includes(condition),
    );
  return readyHref === requested.href ? requested : sameLife ? loaded : requested;
}
/** Keep the previous atlas drawn until the next one is decoded.
 * @param {string} href
 * @param {typeof Image} [ImageClass]
 * @returns {Promise<boolean>} */
export function loadSpriteImage(href, ImageClass = globalThis.Image) {
  if (images.has(href)) {
    return images.get(href);
  }
  if (!ImageClass) {
    return Promise.resolve(false);
  }
  /** @type {Promise<boolean>} */
  const promise = new Promise((resolve) => {
    const image = new ImageClass();
    image.onload = async () => {
      try {
        await image.decode?.();
      } catch {
        /* onload still confirms a usable image. */
      }
      resolve(true);
    };
    image.onerror = () => resolve(false);
    image.src = href;
  });
  images.set(href, promise);
  return promise;
}
