/**
 * The fee as the contracts print it: `€[TOTAL FEE] ([FEE IN WORDS] euros)`.
 * The models supply the euro sign and the word "euros", so both helpers
 * return the bare amount.
 *
 * Amounts are integer cents, as everywhere in the platform. Anything else
 * (a fraction, a negative, NaN) is rounded and clamped to zero rather than
 * thrown: this runs inside a PDF a client is waiting for.
 */

function wholeCents(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.max(0, Math.round(cents));
}

/**
 * `14900` becomes `149`, `14950` becomes `149.50`. No thousands separator:
 * a comma reads as a decimal mark in Portugal, and the words that follow in
 * the contract settle the amount anyway.
 */
export function euroAmount(cents: number): string {
  const total = wholeCents(cents);
  const euros = Math.floor(total / 100);
  const rest = total % 100;
  return rest === 0 ? String(euros) : `${euros}.${String(rest).padStart(2, "0")}`;
}

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = ["", "thousand", "million", "billion", "trillion"];

/** 1 to 999, British style: "one hundred and forty-nine". */
function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${ONES[hundreds]} hundred`);
  if (rest > 0) {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    const word = rest < 20 ? ONES[rest] : ones === 0 ? TENS[tens] : `${TENS[tens]}-${ONES[ones]}`;
    parts.push(hundreds > 0 ? `and ${word}` : word);
  }
  return parts.join(" ");
}

/** A whole number in British English words: "and" before the tens, after a hundred or after a bare thousand. */
function integerWords(n: number): string {
  if (n === 0) return ONES[0];

  const groups: number[] = [];
  for (let rest = n; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  if (groups.length > SCALES.length) return String(n);

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (group === 0) continue;
    let words = belowThousand(group);
    // "one thousand and one", "two million and fifty": the last group takes
    // an "and" when it has no hundreds of its own to carry one.
    if (i === 0 && parts.length > 0 && group < 100) words = `and ${words}`;
    parts.push(i === 0 ? words : `${words} ${SCALES[i]}`);
  }
  return parts.join(" ");
}

/**
 * The amount in words, to sit before the model's own "euros":
 * `14900` becomes `one hundred and forty-nine`. Cents, when there are any,
 * are read as a decimal, digit by digit, so the phrase still ends where
 * "euros" can follow it: `14950` becomes
 * `one hundred and forty-nine point five zero`.
 */
export function euroWords(cents: number): string {
  const total = wholeCents(cents);
  const euros = integerWords(Math.floor(total / 100));
  const rest = total % 100;
  if (rest === 0) return euros;
  return `${euros} point ${ONES[Math.floor(rest / 10)]} ${ONES[rest % 10]}`;
}
