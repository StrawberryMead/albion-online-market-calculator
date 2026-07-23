export function debounce(fn, ms = 250) {
  let handle = null;
  return function debounced(...args) {
    if (handle) clearTimeout(handle);
    handle = setTimeout(() => {
      handle = null;
      fn.apply(this, args);
    }, ms);
  };
}
