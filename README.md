# SynFiat

## Requirements
- NPM
- Truffle

## Installation
```
git clone git@github.com:opz/SynFiat.git
cd SynFiat
npm install
```

### Configure networks
The configuration is specified in `truffle-config.js`.

To use an Ethereum client with the Kovan network, set the following environment variables:
- `ETH_WALLET_MNEMONIC` The 12 word seed phrase for the accounts used to test and deploy the SynFiat smart contracts.
- `ETH_KOVAN_ENDPOINT` The endpoint for the Ethereum client connected to Kovan.

  E.g. `"http://127.0.0.1:8545"` for a local client or `"https://kovan.infura.io/v3/{Infura ID}"` for an Infura client.

Other networks can be created by adding them to the `networks` object. Truffle can connect to these networks using the `--network` parameter.

E.g. `truffle console --network kovan`.

## Smart contracts
[![](https://mermaid.ink/img/eyJjb2RlIjoiY2xhc3NEaWFncmFtXG4gICAgUlRva2VuIDwtLSBUSUNcbiAgICBEQUkgPC0tIFRJQ1xuICAgIEVSQzIwIDx8LS0gUlRva2VuXG4gICAgRVJDMjAgPHwtLSBUb2tlbml6ZWREZXJpdmF0aXZlXG4gICAgRVJDMjAgPHwtLSBEQUlcbiAgICBDVG9rZW4gPC0tIFJUb2tlblxuICAgIEVSQzIwIDx8LS0gQ1Rva2VuXG4gICAgREFJIDwtLSBDVG9rZW5cbiAgICBEQUkgPC0tIFJUb2tlblxuICAgIFRva2VuaXplZERlcml2YXRpdmUgPC0tIFRJQ1xuICAgIFRva2VuaXplZERlcml2YXRpdmVDcmVhdG9yIDwtLSBUSUNcbiAgICBUb2tlbml6ZWREZXJpdmF0aXZlICotLSBUb2tlbml6ZWREZXJpdmF0aXZlQ3JlYXRvclxuICAgIE93bmFibGUgPHwtLSBBZGRyZXNzV2hpdGVsaXN0XG4gICAgQWRkcmVzc1doaXRlbGlzdCA8LS0gVG9rZW5pemVkRGVyaXZhdGl2ZUNyZWF0b3JcbiAgICBQcmljZUZlZWRJbnRlcmZhY2UgPHwtLSBQcm92YWJsZVByaWNlRmVlZFxuICAgIHVzaW5nUHJvdmFibGUgPHwtLSBQcm92YWJsZVByaWNlRmVlZFxuICAgIFByb3ZhYmxlUHJpY2VGZWVkIDwtLSBUb2tlbml6ZWREZXJpdmF0aXZlXG4gICAgT3duYWJsZSA8fC0tIFRJQ1xuICAgIEZvcmV4VGltZSA8fC0tIFRJQ1xuICAgIEZvcmV4VGltZSA8fC0tIFByb3ZhYmxlUHJpY2VGZWVkXG4gICAgY2xhc3MgT3duYWJsZXtcbiAgICAgICAgK2FkZHJlc3Mgb3duZXJcbiAgICAgICAgK29ubHlPd25lcigpXG4gICAgfVxuICAgIGNsYXNzIEZvcmV4VGltZXtcbiAgICAgICAgK2ZvcmV4T3BlbigpXG4gICAgfVxuXHRjbGFzcyBUSUN7XG4gICAgICAgICtUb2tlbml6ZWREZXJpdmF0aXZlIGRlcml2YXRpdmVcblx0XHQrRVJDMjAgdG9rZW5cbiAgICAgICAgK1JUb2tlbiBydG9rZW5cbiAgICAgICAgK2NvbnN0cnVjdG9yKGRlcml2YXRpdmVDcmVhdG9yLCBwYXJhbXMsIHByb3ZpZGVyKVxuXHRcdCttaW50KGFtb3VudClcblx0XHQrZGVwb3NpdChhbW91bnRUb0RlcG9zaXQpXG4gICAgICAgICtyZWRlZW1Ub2tlbnModG9rZW5zVG9SZWRlZW0pXG4gICAgICAgICt3aXRoZHJhdyhhbW91bnQpXG4gICAgICAgICtnZXRQcm92aWRlclJlcXVpcmVkTWFyZ2luKClcbiAgICAgICAgK2dldFByb3ZpZGVyRXhjZXNzTWFyZ2luKClcblx0fVxuICAgIGNsYXNzIEVSQzIwe1xuICAgICAgICArdWludDI1NiB0b3RhbFN1cHBseVxuICAgICAgICArYmFsYW5jZU9mKGFjY291bnQpXG4gICAgICAgICt0cmFuc2ZlcihyZWNpcGllbnQsIGFtb3VudClcbiAgICAgICAgK2FwcHJvdmUoc3BlbmRlciwgYW1vdW50KVxuICAgICAgICArdHJhbnNmZXJGcm9tKHNlbmRlciwgcmVjaXBpZW50LCBhbW91bnQpXG4gICAgfVxuICAgIGNsYXNzIFRva2VuaXplZERlcml2YXRpdmVDcmVhdG9ye1xuICAgICAgICArQWRkcmVzc1doaXRlbGlzdCBtYXJnaW5DdXJyZW5jeVdoaXRlbGlzdFxuICAgICAgICArY3JlYXRlVG9rZW5pemVkRGVyaXZhdGl2ZShwYXJhbXMpXG4gICAgfVxuICAgIGNsYXNzIEFkZHJlc3NXaGl0ZWxpc3R7XG4gICAgICAgICtpc09uV2hpdGVsaXN0KGVsZW1lbnRUb0NoZWNrKVxuICAgIH1cbiAgICBjbGFzcyBQcm92YWJsZVByaWNlRmVlZHtcbiAgICAgICAgK2NvbnN0cnVjdG9yKF9pc1Rlc3QsIHN0YXJ0aW5nUHJpY2UsIGlkZW50aWZpZXIpXG4gICAgICAgICtpc0lkZW50aWZpZXJTdXBwb3J0ZWQoaWRlbnRpZmllcilcbiAgICAgICAgK2xhdGVzdFByaWNlKGlkZW50aWZpZXIpXG4gICAgICAgICt1cGRhdGVQcmljZShpZGVudGlmaWVyKVxuICAgICAgICArd2l0aGRyYXcoYW1vdW50KVxuICAgIH1cbiAgICBjbGFzcyBSVG9rZW57XG4gICAgICAgICtjcmVhdGVIYXQocmVjaXBpZW50cywgcHJvcG9ydGlvbnMsIGRvQ2hhbmdlSGF0KVxuICAgICAgICArbWludFdpdGhTZWxlY3RlZEhhdChtaW50QW1vdW50LCBoYXRJRClcbiAgICAgICAgK3JlZGVlbUFuZFRyYW5zZmVyKHJlZGVlbVRvLCByZWRlZW1Ub2tlbnMpXG4gICAgfVxuICAgIGNsYXNzIFRva2VuaXplZERlcml2YXRpdmV7XG4gICAgICAgICtzdHJ1Y3QgZGVyaXZhdGl2ZVN0b3JhZ2VcbiAgICAgICAgK2Rpc3B1dGUoZGVwb3NpdE1hcmdpbilcbiAgICAgICAgK3JlbWFyZ2luKClcbiAgICAgICAgK2FjY2VwdFByaWNlQW5kU2V0dGxlKClcbiAgICAgICAgK3NldHRsZSgpXG4gICAgfVxuICAgIGNsYXNzIENUb2tlbntcbiAgICAgICAgK2FjY3J1ZUludGVyZXN0KClcbiAgICB9IiwibWVybWFpZCI6eyJ0aGVtZSI6ImRlZmF1bHQifSwidXBkYXRlRWRpdG9yIjpmYWxzZX0)](https://mermaid-js.github.io/mermaid-live-editor/#/edit/eyJjb2RlIjoiY2xhc3NEaWFncmFtXG4gICAgUlRva2VuIDwtLSBUSUNcbiAgICBEQUkgPC0tIFRJQ1xuICAgIEVSQzIwIDx8LS0gUlRva2VuXG4gICAgRVJDMjAgPHwtLSBUb2tlbml6ZWREZXJpdmF0aXZlXG4gICAgRVJDMjAgPHwtLSBEQUlcbiAgICBDVG9rZW4gPC0tIFJUb2tlblxuICAgIEVSQzIwIDx8LS0gQ1Rva2VuXG4gICAgREFJIDwtLSBDVG9rZW5cbiAgICBEQUkgPC0tIFJUb2tlblxuICAgIFRva2VuaXplZERlcml2YXRpdmUgPC0tIFRJQ1xuICAgIFRva2VuaXplZERlcml2YXRpdmVDcmVhdG9yIDwtLSBUSUNcbiAgICBUb2tlbml6ZWREZXJpdmF0aXZlICotLSBUb2tlbml6ZWREZXJpdmF0aXZlQ3JlYXRvclxuICAgIE93bmFibGUgPHwtLSBBZGRyZXNzV2hpdGVsaXN0XG4gICAgQWRkcmVzc1doaXRlbGlzdCA8LS0gVG9rZW5pemVkRGVyaXZhdGl2ZUNyZWF0b3JcbiAgICBQcmljZUZlZWRJbnRlcmZhY2UgPHwtLSBQcm92YWJsZVByaWNlRmVlZFxuICAgIHVzaW5nUHJvdmFibGUgPHwtLSBQcm92YWJsZVByaWNlRmVlZFxuICAgIFByb3ZhYmxlUHJpY2VGZWVkIDwtLSBUb2tlbml6ZWREZXJpdmF0aXZlXG4gICAgT3duYWJsZSA8fC0tIFRJQ1xuICAgIEZvcmV4VGltZSA8fC0tIFRJQ1xuICAgIEZvcmV4VGltZSA8fC0tIFByb3ZhYmxlUHJpY2VGZWVkXG4gICAgY2xhc3MgT3duYWJsZXtcbiAgICAgICAgK2FkZHJlc3Mgb3duZXJcbiAgICAgICAgK29ubHlPd25lcigpXG4gICAgfVxuICAgIGNsYXNzIEZvcmV4VGltZXtcbiAgICAgICAgK2ZvcmV4T3BlbigpXG4gICAgfVxuXHRjbGFzcyBUSUN7XG4gICAgICAgICtUb2tlbml6ZWREZXJpdmF0aXZlIGRlcml2YXRpdmVcblx0XHQrRVJDMjAgdG9rZW5cbiAgICAgICAgK1JUb2tlbiBydG9rZW5cbiAgICAgICAgK2NvbnN0cnVjdG9yKGRlcml2YXRpdmVDcmVhdG9yLCBwYXJhbXMsIHByb3ZpZGVyKVxuXHRcdCttaW50KGFtb3VudClcblx0XHQrZGVwb3NpdChhbW91bnRUb0RlcG9zaXQpXG4gICAgICAgICtyZWRlZW1Ub2tlbnModG9rZW5zVG9SZWRlZW0pXG4gICAgICAgICt3aXRoZHJhdyhhbW91bnQpXG4gICAgICAgICtnZXRQcm92aWRlclJlcXVpcmVkTWFyZ2luKClcbiAgICAgICAgK2dldFByb3ZpZGVyRXhjZXNzTWFyZ2luKClcblx0fVxuICAgIGNsYXNzIEVSQzIwe1xuICAgICAgICArdWludDI1NiB0b3RhbFN1cHBseVxuICAgICAgICArYmFsYW5jZU9mKGFjY291bnQpXG4gICAgICAgICt0cmFuc2ZlcihyZWNpcGllbnQsIGFtb3VudClcbiAgICAgICAgK2FwcHJvdmUoc3BlbmRlciwgYW1vdW50KVxuICAgICAgICArdHJhbnNmZXJGcm9tKHNlbmRlciwgcmVjaXBpZW50LCBhbW91bnQpXG4gICAgfVxuICAgIGNsYXNzIFRva2VuaXplZERlcml2YXRpdmVDcmVhdG9ye1xuICAgICAgICArQWRkcmVzc1doaXRlbGlzdCBtYXJnaW5DdXJyZW5jeVdoaXRlbGlzdFxuICAgICAgICArY3JlYXRlVG9rZW5pemVkRGVyaXZhdGl2ZShwYXJhbXMpXG4gICAgfVxuICAgIGNsYXNzIEFkZHJlc3NXaGl0ZWxpc3R7XG4gICAgICAgICtpc09uV2hpdGVsaXN0KGVsZW1lbnRUb0NoZWNrKVxuICAgIH1cbiAgICBjbGFzcyBQcm92YWJsZVByaWNlRmVlZHtcbiAgICAgICAgK2NvbnN0cnVjdG9yKF9pc1Rlc3QsIHN0YXJ0aW5nUHJpY2UsIGlkZW50aWZpZXIpXG4gICAgICAgICtpc0lkZW50aWZpZXJTdXBwb3J0ZWQoaWRlbnRpZmllcilcbiAgICAgICAgK2xhdGVzdFByaWNlKGlkZW50aWZpZXIpXG4gICAgICAgICt1cGRhdGVQcmljZShpZGVudGlmaWVyKVxuICAgICAgICArd2l0aGRyYXcoYW1vdW50KVxuICAgIH1cbiAgICBjbGFzcyBSVG9rZW57XG4gICAgICAgICtjcmVhdGVIYXQocmVjaXBpZW50cywgcHJvcG9ydGlvbnMsIGRvQ2hhbmdlSGF0KVxuICAgICAgICArbWludFdpdGhTZWxlY3RlZEhhdChtaW50QW1vdW50LCBoYXRJRClcbiAgICAgICAgK3JlZGVlbUFuZFRyYW5zZmVyKHJlZGVlbVRvLCByZWRlZW1Ub2tlbnMpXG4gICAgfVxuICAgIGNsYXNzIFRva2VuaXplZERlcml2YXRpdmV7XG4gICAgICAgICtzdHJ1Y3QgZGVyaXZhdGl2ZVN0b3JhZ2VcbiAgICAgICAgK2Rpc3B1dGUoZGVwb3NpdE1hcmdpbilcbiAgICAgICAgK3JlbWFyZ2luKClcbiAgICAgICAgK2FjY2VwdFByaWNlQW5kU2V0dGxlKClcbiAgICAgICAgK3NldHRsZSgpXG4gICAgfVxuICAgIGNsYXNzIENUb2tlbntcbiAgICAgICAgK2FjY3J1ZUludGVyZXN0KClcbiAgICB9IiwibWVybWFpZCI6eyJ0aGVtZSI6ImRlZmF1bHQifSwidXBkYXRlRWRpdG9yIjpmYWxzZX0)

### Installing new smart contract dependencies
Use NPM to install new dependencies in the root project directory. Smart contracts can import these dependencies and the compiler will resolve the correct path.

E.g. `import "@openzeppelin/contracts/math/SafeMath.sol";`

### Smart contract commands
SynFiat uses Truffle and therefore all the standard Truffle commands are available:
- `truffle console`
- `truffle compile`
- `truffle migrate`
- `truffle test`

## Front-end client
A front-end client created with create-react-app that uses React and Web3 can be developed in the `./client` directory.

### Client dependencies
Run `npm install` in the client directory to install the client dependencies.

All new client dependencies must be installed here and not in the root project directory.

### Running the client
Run `npm run start` to start a local web server for client development. The server defaults to port 3000 and will watch for code changes.

## Testing
There are a few automated tests written for the TIC. These are helpful to run to ensure there are no regressions introduced when working on the contract.

### Requirements for running the TIC tests
- **Tests must be run on either the Kovan network or a fork of the Kovan network.**
  - This is necessary as the tests depend on existing contracts for DAI, rDAI, and TokenizedDerivativeCreator. The rDAI address must also exist on the whitelist for the TokenizedDerivativeCreator.
  - Creating a fork of the Kovan network with Ganache is easy. For example, if using Infura as the Ethereum client, run `ganache-cli -f https://kovan.infura.io/v3/{Infura ID}`.

- **Truffle must be configured to create at least 2 accounts for the network used to run the tests.**
  - For example, if using the HDWallet provider, the 4th argument specifying the number of accounts to make must be set to 2: `HDWalletProvider(mnemonic, kovanEndpoint, 0, 2)`.

- **The 2 accounts used to run tests must be funded with ETH and DAI.**
  - To obtain Kovan ETH (KETH) use the [Kovan faucet](https://faucet.kovan.network).
  - To obtain DAI, either purchase some with KETH on [Oasis](https://oasis.app/trade/market/WETH/DAI) (make sure you set MetaMask to the Kovan network) or follow [these instructions](https://github.com/makerdao/developerguides/blob/master/mcd/mcd-cli/mcd-cli-guide-01/mcd-cli-guide-01.md) to set up a CDP and mint DAI.
  - Remember, it is important that the DAI contract used is the same contract as the rDAI underlying that has been whitelisted by the TokenizedDerivativeCreator.
  - You can find a list of all the Kovan DAI contract addresses that will work with the whitelisted rDAI contract [here](https://changelog.makerdao.com/releases/kovan/1.0.1/contracts.json).

### Running the TIC tests
To run the TIC tests, simply use the following Truffle command:
```
truffle --network kovan test
```

## Deployment
### Deployment requirements
The SynFiat migration scripts in `./migrations` will only deploy when used with either the Kovan network or a fork of Kovan.

Any network configuration used for deployment must have a gas limit of at least 8,000,000 in order to deploy the TIC. The default Kovan configuration in `truffle-config.js` has this limit already set.

### Running migrations
To deploy the SynFiat smart contracts with the migration scripts, run the following Truffle command:
```
truffle --network kovan migrate
```
If the contracts have already been deployed but changes have been made and they must be deployed again, use the `--reset` flag.

### Changing base TokenizedDerivative parameters
The parameters for the TokenizedDerivative contracts created by TICs can be changed in `./migrations/4_deploy_tics.js`.

```
let params = {
  defaultPenalty: web3Utils.toWei("1", "ether"),
  supportedMove,
  fixedYearlyFee: "0",
  withdrawLimit,
  disputeDeposit: web3Utils.toWei("1", "ether"),
  expiry: 0, // Temporarily set no expiry
  returnType: "0", // Linear
  returnCalculator,
  marginCurrency
};
```

### Creating new SynFiat assets
New synthetic assets can be created by modifying `./synthetic-assets.json` and `./chainlink-aggregators.json` before running the migration scripts.

Simply add a new object to the JSON array in `./synthetic-assets.json` such as:

```
[
  ...
  {
    "name": "Jarvis Synthetic Euro", // The ERC-20 name
    "symbol": "jEUR", // The ERC-20 symbol
    "identifier": "EUR/USD" // The price feed identifier
  }
]
```

Then add the address of a Chainlink aggregator to `./chainlink-aggregators.json`. Make sure to put it under the correct network ID (Kovan is "42") and to make the object key the same as the identifier used for the new synthetic asset that has been configured.

For example:
```
{
  "42": { // The network the aggregator is deployed to
    ...
    "EUR/USD": "0xf23CCdA8333f658c43E7fC19aa00f6F5722eB225"
  }
}
```

Now when running `truffle --network kovan migrate --reset`, this new synthetic asset will also be deployed.

## Using the TIC (Token Issuer Contract)
First import the Truffle artifact stored in `./client/src/contracts` and create the contract instance with web3.
```
import TIC from "./contracts/TIC.json";

const networkId = await web3.eth.net.getId();
const tic = new web3.eth.Contract(TIC.abi, TIC.networks[networkId].address);
```

Then create the DAI contract instance. This is needed to approve the DAI transfers that will be made by the TIC.
```
const erc20Abi = [{ "constant": false, "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }];
const daiAddress = "0x462303f77a3f17Dbd95eb7bab412FE4937F9B9CB";
const dai = new web3.eth.Contract(erc20Abi, daiAddress);
```

Finally get the account addresses we will use to interact with the contracts.
```
const accounts = await web3.eth.getAccounts();
```

### Making a collateral deposit as a liquidity provider 
In this case we will assume that `accounts[0]` is the liquidity provider.

Set the amount of collateral to deposit.
```
const collateral = web3.utils.toWei("10", "ether");
```

Approve the transfer of DAI collateral.
```
await dai.methods.approve(tic.address, collateral).send({ from: accounts[0] });
```

Deposit the DAI collateral.
```
await tic.methods.deposit(collateral).send({ from: accounts[0] });
```

### Minting jEUR as a user
Set the amount of collateral used to mint tokens.
```
const collateral = web3.utils.toWei("10", "ether");
```

Approve the transfer of DAI collateral.
```
await dai.methods.approve(tic.address, collateral).send({ from: accounts[0] });
```

Mint the jEUR tokens.
```
await tic.methods.mint(collateral).send({ from: accounts[0] });
```

### Viewing jEUR balance
Retrieve the TokenizedDerivative contract from the TIC.
```
const derivativeAddress = await tic.methods.derivative().call();
const derivative = new web3.eth.Contract(erc20Abi, derivativeAddress);
```

View the jEUR balance.
```
const jEurBalance = await derivative.methods.balanceOf(accounts[0]).call();
console.log(web3.utils.fromWei(jEurBalance.toString(), "ether"));
```

### Transfering jEUR
Retrieve the TokenizedDerivative contract from the TIC.
```
const derivativeAddress = await tic.methods.derivative().call();
const derivative = new web3.eth.Contract(erc20Abi, derivativeAddress);
```

Set the amount of jEUR tokens to transfer. In this case we will transfer all the tokens owned by a user.
```
const jEurToTransfer = await derivative.methods.balanceOf(accounts[0]).call();
```

Transfer the jEUR tokens to `accounts[1]`.
```
await derivative.methods.transfer(accounts[1], jEurToTransfer).send({ from: accounts[0] });
```

### Redeeming jEUR as a user
Retrieve the TokenizedDerivative contract from the TIC.
```
const derivativeAddress = await tic.methods.derivative().call();
const derivative = new web3.eth.Contract(erc20Abi, derivativeAddress);
```

Set the amount of jEUR tokens to redeem. In this case we will redeem all the tokens owned by a user.
```
const jEurBalance = await derivative.methods.balanceOf(accounts[0]).call();
```

Approve the transfer of jEUR tokens.
```
await derivative.methods.approve(tic.options.address, jEurBalance).send({ from: accounts[0] });
```

Redeem the user's jEUR tokens.
```
await derivative.methods.redeemTokens(jEurBalance).send({ from: accounts[0] });
```

### Checking collateral liquidity provider
Check the total required collateral a liquidity provider must supply.
```
const requiredCollateral = await tic.methods.getProviderRequiredMargin().call();
console.log(web3.utils.fromWei(requiredCollateral.toString(), "ether"));
```

Check the excess collateral a liquidity provider has supplied. This value will be negative if the liquidity provider must supply more collateral to meet the requirement.
```
const excessCollateral = await tic.methods.getProviderExcessMargin().call();
console.log(web3.utils.fromWei(excessCollateral.toString(), "ether"));
```

### Withdrawing collateral as a liquidity provider
In this case we will assume that `accounts[0]` is the liquidity provider.

Set the amount of collateral to withdraw. Note that a liquidity provider can only withdraw margin in excess of the amount required. In this case, all excess collateral will be withdrawn.
```
const excessCollateral = await tic.methods.getProviderExcessMargin().call();
```

Withdraw the collateral to the liquidity provider's account.
```
await tic.methods.withdraw(excessCollateral).send({ from: accounts[0] });
```
