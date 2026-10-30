/** UTC weekdays only; public holidays require a real jurisdictional calendar before a pilot. */
export function reviewTarget(start: number, workingDays = 10) {
  const date = new Date(start * 1000);
  let left = workingDays;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) left--;
  }
  return Math.floor(date.getTime() / 1000);
}
