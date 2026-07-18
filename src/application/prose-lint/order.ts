const fixedCollator = new Intl.Collator("en-US", { numeric: true, sensitivity: "base" });

export function compareCodePoints(left: string, right: string): number {
  if (left === right) return 0;
  const leftPoints = Array.from(left, (value) => value.codePointAt(0) as number);
  const rightPoints = Array.from(right, (value) => value.codePointAt(0) as number);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftPoints[index] as number) - (rightPoints[index] as number);
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

export function compareDeterministicText(left: string, right: string): number {
  const localized = fixedCollator.compare(left, right);
  return localized !== 0 ? localized : compareCodePoints(left, right);
}
