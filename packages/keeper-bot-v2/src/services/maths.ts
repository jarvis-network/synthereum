export function toWei(etherInput: number) {
  var ether = String(etherInput); // eslint-disable-line
  var base = 10n ** 18n;
  var baseLength = 18;

  // Is it negative?
  var negative = ether.substring(0, 1) === '-'; // eslint-disable-line
  if (negative) {
    ether = ether.substring(1);
  }

  if (ether === '.') {
    throw new Error(
      '[ethjs-unit] while converting number ' +
        etherInput +
        ' to wei, invalid value',
    );
  }

  // Split it into a whole and fractional part
  var comps = ether.split('.'); // eslint-disable-line
  if (comps.length > 2) {
    throw new Error(
      '[ethjs-unit] while converting number ' +
        etherInput +
        ' to wei,  too many decimal points',
    );
  }

  var whole = comps[0],
    fraction = comps[1]; // eslint-disable-line

  if (!whole) {
    whole = '0';
  }
  if (!fraction) {
    fraction = '0';
  }
  if (fraction.length > baseLength) {
    throw new Error(
      '[ethjs-unit] while converting number ' +
        etherInput +
        ' to wei, too many decimal places',
    );
  }

  while (fraction.length < baseLength) {
    fraction += '0';
  }

  const wholeBigInt = BigInt(whole);
  const fractionBigInt = BigInt(fraction);
  var wei = wholeBigInt * base + fractionBigInt;

  if (negative) {
    wei = wei * -1n;
  }

  return wei;
}

export function scale(a: bigint, b: number): bigint {
  return (a * toWei(b)) / 10n ** 18n;
}

export function parseTokens(tokens: string, decimals: number): bigint {
  return BigInt(tokens) * 10n ** BigInt(18 - decimals);
}
