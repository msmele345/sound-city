export function compareStartsAt(a: string, b: string) {
  return instant(a) - instant(b);
}

function instant(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}
