export function compareStartsAt(a: string, b: string) {
  const delta = instant(a) - instant(b);
  return Number.isNaN(delta) ? 0 : delta;
}

function instant(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}
