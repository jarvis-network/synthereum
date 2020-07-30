export function toFixedNumber(amount, numberOfDecimals) {
  const spitedValues = amount.split('.');
  let decimalValue = spitedValues.length > 1 ? spitedValues[1] : '';
  decimalValue = decimalValue.concat('00').substr(0, numberOfDecimals);
  const resultWithZeros = spitedValues[0] + '.' + decimalValue;
  const result = removeZeros(resultWithZeros);
  return result;
}

function removeZeros(stringAmount) {
  let stringResult = stringAmount;
  while (1 == 1) {
    if (stringResult.charAt(stringResult.length - 1) === '0') {
      stringResult = stringResult.slice(0, -1);
    } else if (stringResult.charAt(stringResult.length - 1) === '.') {
      stringResult = stringResult.slice(0, -1);
      return stringResult;
    } else {
      return stringResult;
    }
  }
}
