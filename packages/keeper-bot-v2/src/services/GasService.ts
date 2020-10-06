// import { InputData, Properties } from '../types';

// export class UpdatableGasPrice {
//   gasPrice: number;

//   /**
//    *
//    */
//   constructor(gasPrice: number) {
//     this.gasPrice = gasPrice;
//   }

//   updateGasPrice(gasPrice: number) {
//     this.gasPrice = gasPrice;
//   }

//   getGasPrice() {
//     return this.gasPrice;
//   }
// }

// export class DynamicGasPrice {
//   GWEI: number = 1000000000;
//   gasStation: any;
//   fixedGas: number;
//   initialMultiplier: number;
//   reactiveMultiplier: number;
//   gasMaximum: number;
//   fastPrice: number;

//   constructor(inputData: InputData) {
//     if (inputData.gasGroup.ethgasstationApiKey) {
//       this.gasStation = new EthGasStation(); // ...
//     } else if (inputData.gasGroup.etherchainGasPrice) {
//       this.gasStation = new EtherchainOrg(); // ...
//     } else if (inputData.gasGroup.poanetworkGasPrice) {
//       this.gasStation = new POANetwork(); // ...
//     } else if (inputData.gasGroup.fixedGasPrice) {
//       this.fixedGas = int(round(inputData.gasGroup.fixedGasPrice * this.GWEI));
//     }

//     this.initialMultiplier = inputData.gasInitialMultiplier;
//     this.reactiveMultiplier = inputData.gasReactiveMultiplier;
//     this.gasMaximum = inputData.gasMaximum;
//   }

//   getGasPrice(timeElasped: number): Promise<number> {
//     let initialPrice;
//     // start with fast price from the configured gas API
//     this.fastPrice = undefined;
//     if (this.gasStation) {
//       this.fastPrice = this.gasStation.fastPrice();
//     }

//     // if API produces no price, or remote feed not configured, start with a fixed price
//     if (this.fastPrice === undefined) {
//       if (this.fixedGas) {
//         initialPrice = this.fixedGas;
//       } else {
//         initialPrice = 10 * this.GWEI;
//       }
//       // otherwise, use the API's fast price, adjusted by a coefficient, as our starting point
//     } else {
//       initialPrice = int(round(this.fastPrice * this.initialMultiplier));
//     }

//     return new GeometricGasPrice(
//       initialPrice,
//       30,
//       this.reactiveMultiplier,
//       this.gasMaximum,
//     ).getGasPrice(timeElapsed);
//   }
// }
