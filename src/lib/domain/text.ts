const bidiControls = /[\u202a-\u202e\u2066-\u2069]/;
const visibleChar = /[\p{L}\p{N}\p{P}\p{S}]/u;
const invisibleChar = /[\p{Default_Ignorable_Code_Point}\u2800]/gu;

function isEdgeSpace(code: number): boolean {
  return (code >= 0x0009 && code <= 0x000d) || code === 0x0020 || code === 0x00a0
    || code === 0x1680 || (code >= 0x2000 && code <= 0x200d)
    || code === 0x2028 || code === 0x2029 || code === 0x202f
    || code === 0x205f || code === 0x2060 || code === 0x2800
    || code === 0x3000 || code === 0x3164 || code === 0xfeff;
}

export function cleanText(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && isEdgeSpace(text.charCodeAt(start))) start++;
  while (end > start && isEdgeSpace(text.charCodeAt(end - 1))) end--;
  return text.slice(start, end);
}

export function hasBidiControls(text: string): boolean {
  return bidiControls.test(text);
}

export function hasVisibleChar(text: string): boolean {
  return visibleChar.test(text.replace(invisibleChar, ''));
}
