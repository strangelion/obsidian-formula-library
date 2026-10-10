// Word can import a standalone MathML text clipboard as editable Office Math.
// HTML takes precedence on older Word builds and can flatten the same markup.
// This is an import payload, not a serialized OLE object or a native add-in.
export function wordClipboardMathML(content) {
  if (typeof content !== "string" || !content.trim() || new TextEncoder().encode(content).length > 256 * 1024
    || /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(content)) throw new Error("INVALID_WORD_MATHML");
  const document = new DOMParser().parseFromString(content, "application/xml");
  const root = document.documentElement;
  const namespace = "http://www.w3.org/1998/Math/MathML";
  if (document.querySelector("parsererror") || root.localName !== "math" || root.namespaceURI !== namespace)
    throw new Error("INVALID_WORD_MATHML");
  for (const element of [root, ...root.querySelectorAll("*")]) {
    if (element.namespaceURI !== namespace) throw new Error("INVALID_WORD_MATHML");
    for (const attribute of element.attributes) {
      if (/^(?:href|src|on\w+)$/i.test(attribute.localName)) throw new Error("INVALID_WORD_MATHML");
    }
  }
  return new XMLSerializer().serializeToString(root);
}
