export function replaceTag(element, tagName) {
  if (element.localName === tagName) return element;
  const replacement = document.createElement(tagName);
  for (const { name, value } of element.attributes) replacement.setAttribute(name, value);
  replacement.append(...element.childNodes);
  const hadFocus = document.activeElement === element;
  element.replaceWith(replacement);
  if (hadFocus) replacement.focus({ preventScroll: true });
  return replacement;
}
