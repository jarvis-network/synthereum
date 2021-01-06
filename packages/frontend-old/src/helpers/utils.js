import { fromWei, toWei } from 'web3-utils';

export function toFixedNumber(amount, numberOfDecimals) {
  const stringAmount = amount.toString();
  const spitedValues = stringAmount.split('.');
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

export function fromScaledWei(amount, decimals) {
  // console.log(amount);
  // console.log(decimals);
  let scaledAmount = 0;
  if (decimals == 6) {
    scaledAmount = fromWei(amount, 'mwei');
  } else if (decimals == 18) {
    scaledAmount = fromWei(amount);
  }
  return scaledAmount;
}

export function toScaledWei(amount, decimals) {
  // console.log(amount);
  /*console.log(decimals);
  console.log(toWei(amount) );
  console.log(10**(18 - decimals));*/
  let scaledAmount = 0;
  if (decimals == 6) {
    scaledAmount = toWei(amount, 'mwei');
    // console.log('RESULT SIX');
    // console.log(scaledAmount);
  } else if (decimals == 18) {
    scaledAmount = toWei(amount);
    // console.log('RESULT');
    // console.log(scaledAmount);
  }
  return scaledAmount;
}
