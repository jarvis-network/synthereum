import { assertIsAddress } from '@jarvis-network/web3-utils/eth/address';
import {
  assertIsNetworkId,
  Network,
} from '@jarvis-network/web3-utils/eth/networks';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function NetworkType(validationOptions?: ValidationOptions) {
  return (obj: object, propertyName: string) => {
    registerDecorator({
      name: 'NetworkType',
      target: obj.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          return !!assertIsNetworkId(value);
        },
      },
    });
  };
}

export function ETHAddressValidator(validationOptions?: ValidationOptions) {
  return (obj: object, propertyName: string) => {
    registerDecorator({
      name: 'ETHAddressValidator',
      target: obj.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          return !!assertIsAddress<Network>(value);
        },
      },
    });
  };
}
