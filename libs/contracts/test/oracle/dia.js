const {
    ZERO_ADDRESS,
} = require('@jarvis-network/hardhat-utils/dist/deployment/migrationUtils');
const truffleAssert = require('truffle-assertions');
const web3Utils = require('web3-utils');
const { toBN, toWei, toHex } = web3Utils;

const { artifacts } = require('hardhat');
const SynthereumFinder = artifacts.require('SynthereumFinder');
const DiaPriceFeed = artifacts.require('SynthereumDiaPriceFeed');
const MockDiaOracle = artifacts.require('MockDiaOracle');
const OracleRouter = artifacts.require('OracleRouter');

contract('Synthereum DIA price feed', accounts => {
    let finderInstance, router;
    let admin = accounts[0];
    let maintainer = accounts[1];

    before(async () => {
        finderInstance = await SynthereumFinder.deployed();
        router = await OracleRouter.deployed();
        await finderInstance.changeImplementationAddress(
            web3Utils.stringToHex('OracleRouter'),
            router.address,
            { from: maintainer },
        );
    });

    describe('DIA Provider', async () => {
        let diaInstance, diaOracle, diaOracleAddress;
        let priceIdentifier = web3Utils.toHex('NGN-USD');
        let value = toWei('0.0022');
        let time;

        before(async () => {
            diaInstance = await DiaPriceFeed.deployed();
            diaOracle = await MockDiaOracle.new();
            diaOracleAddress = diaOracle.address;
            time = (await web3.eth.getBlock('latest')).timestamp;
            await diaOracle.setValue(priceIdentifier, value, time);
        });

        it('Can register a price feed aggregator', async () => {
            let tx = await diaInstance.setAggregator(priceIdentifier, diaOracle, {
                from: maintainer,
            });
            truffleAssert.eventEmitted(tx, 'SetAggregator', ev => {
                return (
                    ev.priceId == web3Utils.padRight(priceIdentifier, 64) &&
                    ev.aggregator == diaOracleAddress
                );
            });
            let server = await diaInstance.aggregators.call(priceIdentifier);
            assert.equal(server, serverAddress);
        });

        it('Reverts with zero address aggregator', async () => {
            await truffleAssert.reverts(
                diaInstance.setAggregator(priceIdentifier, ZERO_ADDRESS, {
                    from: maintainer,
                }),
            );
        });

        it('Correctly retrieve price from aggregator', async () => {
            let res = await diaInstance.getLatestPrice.call(priceIdentifier);
            assert.equal(res.toString(), value.toString());
        });

        it('Reverts if price is not registered', async () => {
            await truffleAssert.reverts(
                diaInstance.getLatestPrice.call(toHex('LOL/USD')),
                'Price identifier not supported',
            );
        });
    });
});
