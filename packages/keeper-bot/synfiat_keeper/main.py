# This file is part of Maker Keeper Framework.
# This file was modified for the SynFiat Keeper on 2020-05-03.
#
# Copyright (C) 2018-2020 reverendus, bargst, EdNoepel
# Modifications Copyright (C) 2020 Will Shahda
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

import argparse
import asyncio
import functools
import json
import logging
import os
import pkg_resources
import pprint
import requests
import sys
import time
import threading

from datetime import datetime
from requests.exceptions import RequestException
from web3 import Web3, HTTPProvider, WebsocketProvider
from web3.exceptions import BlockNotFound

from pymaker import Address
from pymaker.keys import register_keys
from pymaker.lifecycle import Lifecycle

from synfiat_keeper.gas import DynamicGasPrice, UpdatableGasPrice


class SynFiatKeeper:
    logger = logging.getLogger()

    def __init__(self, args: list, **kwargs):
        parser = argparse.ArgumentParser(prog="synfiat-keeper")

        parser.add_argument("--rpc-host", type=str, default="http://localhost:8545",
                            help="JSON-RPC endpoint URI with port (default: `http://localhost:8545`)")
        parser.add_argument("--rpc-timeout", type=int, default=60,
                            help="JSON-RPC timeout (in seconds, default: 60)")

        parser.add_argument("--eth-from", type=str, required=True,
                            help="Ethereum account from which to send transactions")
        parser.add_argument("--eth-key", type=str, nargs="*",
                            help="Ethereum private key(s) to use (e.g. \"key_file=aaa.json,pass_file=aaa.pass\")")

        parser.add_argument("--frequency", type=int, default=4,
                            help="Frequency to check for new requests (in seconds, default: 4)")

        parser.add_argument("--max-slippage", type=int, default=0.01,
                            help="Maximum slippage allowed when approving requests (percent expressed as a decimal, default: 0.01)")

        gas_group = parser.add_mutually_exclusive_group()
        gas_group.add_argument("--ethgasstation-api-key", type=str, default=None, help="ethgasstation API key")
        gas_group.add_argument("--etherchain-gas-price", dest="etherchain_gas", action="store_true",
                               help="Use etherchain.org gas price")
        gas_group.add_argument("--poanetwork-gas-price", dest="poanetwork_gas", action="store_true",
                               help="Use POANetwork gas price")
        gas_group.add_argument("--fixed-gas-price", type=float, default=None,
                               help="Uses a fixed value (in Gwei) instead of an external API to determine initial gas")
        parser.add_argument("--poanetwork-url", type=str, default=None, help="Alternative POANetwork URL")
        parser.add_argument("--gas-initial-multiplier", type=float, default=1.0,
                            help="Adjusts the initial API-provided \"fast\" gas price, default 1.0")
        parser.add_argument("--gas-reactive-multiplier", type=float, default=2.25,
                            help="Increases gas price when transactions haven't been mined after some time")
        parser.add_argument("--gas-maximum", type=float, default=5000,
                            help="Places an upper bound (in Gwei) on the amount of gas to use for a single TX")

        parser.add_argument("--debug", dest="debug", action="store_true",
                            help="Enable debug output")

        self.arguments = parser.parse_args(args)

        # Configure connection to the chain
        provider = WebsocketProvider(endpoint_uri=self.arguments.rpc_host,
                                websocket_kwargs={"ping_timeout": self.arguments.rpc_timeout})
        self.web3: Web3 = kwargs["web3"] if "web3" in kwargs else Web3(provider)
        self.web3.eth.defaultAccount = self.arguments.eth_from
        register_keys(self.web3, self.arguments.eth_key)
        self.our_address = Address(self.arguments.eth_from)

        logging.basicConfig(format="%(asctime)-15s %(levelname)-8s %(message)s",
                            level=(logging.DEBUG if self.arguments.debug else logging.INFO))

        # Create gas strategy used for non-bids and bids which do not supply gas price
        self.gas_price = DynamicGasPrice(self.arguments)

        self.max_slippage = self.arguments.max_slippage

        # Get TICFactory contract
        cwd = os.path.dirname(os.path.realpath(__file__))
        self.tic_config = json.loads(open(os.path.join(cwd, "../config", "tic.json"), "r").read())
        factory_abi = json.loads(pkg_resources.resource_string(
                "synfiat_keeper.main",
                "abi/TICFactory.json"
            ))
        factory = self.web3.eth.contract(address=self.tic_config["factory_address"], abi=factory_abi)

        # Get TIC contracts
        tic_addresses = [
                factory.functions.symbolToTIC(synthetic["symbol"]).call()
                for synthetic in self.tic_config["synthetics"]
            ]
        tic_abi = json.loads(pkg_resources.resource_string(
                "synfiat_keeper.main",
                "abi/TIC.json"
            ))
        self.tics = [
                (address, self.web3.eth.contract(address=address, abi=tic_abi))
                for address in tic_addresses
            ]

        # Get collateral token contracts
        collateral_token_addresses = [
                tic.functions.collateralToken().call()
                for (_, tic) in self.tics
            ]
        erc20_abi = json.loads(pkg_resources.resource_string(
                "synfiat_keeper.main",
                "abi/IERC20.json"
            ))
        self.collateral_tokens = [
                self.web3.eth.contract(address=address, abi=erc20_abi)
                for address in collateral_token_addresses
            ]

        # Get synthetic token contracts
        synthetic_token_addresses = [
                tic.functions.syntheticToken().call()
                for (_, tic) in self.tics
            ]
        self.synthetic_tokens = [
                self.web3.eth.contract(address=address, abi=erc20_abi)
                for address in synthetic_token_addresses
            ]

        # reduce logspew
        logging.getLogger("urllib3").setLevel(logging.INFO)
        logging.getLogger("web3").setLevel(logging.INFO)
        logging.getLogger("asyncio").setLevel(logging.INFO)
        logging.getLogger("requests").setLevel(logging.INFO)


    def main(self):
        with Lifecycle(self.web3) as lifecycle:
            self.lifecycle = lifecycle
            lifecycle.on_startup(self.startup)
            lifecycle.on_shutdown(self.shutdown)
            lifecycle.every(self.arguments.frequency, self.main_loop)

    def startup(self):
        logging.info(f"Keeper will use {self.gas_price} for transactions")

    def shutdown(self):
        pass

    def is_shutting_down(self) -> bool:
        return self.lifecycle and self.lifecycle.terminated_externally

    def main_loop(self):
        self.check_mint_requests()

        self.check_redeem_requests()

        self.check_exchange_requests()

    def check_mint_requests(self):
        started = datetime.now()

        for i, (_, tic) in enumerate(self.tics):
            mintRequests = tic.functions.getMintRequests().call(
                    { "from": self.web3.eth.defaultAccount }
                )

            self.logger.info(f"Found {len(mintRequests)} mint request(s)")

            for mint in mintRequests:
                reject = False

                price_feed = self.tic_config["synthetics"][i]["price_feed"]
                request_time = mint[1]

                ohlc = self.get_price_feed_ohlc(price_feed, request_time)

                if len(ohlc["c"]) > 0:
                    if price_feed == 'USDCHF':
                        price = 1/(ohlc["c"][0])
                    else:
                        price = ohlc["c"][0]

                    self.logger.info(f"{self.tic_config['synthetics'][i]['symbol']} was ${price} for mint request {mint[0].hex()}")

                    collateral = mint[3][0]*(10**12)
                    tokens = mint[4][0]

                    self.logger.info(f"Minting {tokens} tokens with {collateral} collateral")

                    if collateral >= tokens * price * (1 - self.max_slippage):
                        sender = mint[2]
                        allowance = (self.collateral_tokens[i].functions.allowance(sender, tic.address).call())*(10**12)
                        balance = (self.collateral_tokens[i].functions.balanceOf(sender).call())*(10**12)

                        if balance >= collateral:
                            if allowance >= collateral:
                                self.resolve_request(mint[0], tic.functions.approveMint, "Approved mint")
                            else:
                                reject = True
                                self.logger.info(
                                        f"Unable to approve mint request {mint[0].hex()} until TIC is given an allowance to transfer the user's collateral"
                                    )
                        else:
                            reject = True
                            self.logger.info(f"Mint request {mint[0].hex()} is not covered by user's collateral balance")
                    else:
                        reject = True
                        self.logger.info(f"Mint request {mint[0].hex()} is undercollateralized")
                else:
                    reject = True
                    self.logger.info("Forex is closed")

                if reject:
                    self.resolve_request(mint[0], tic.functions.rejectMint, "Rejected mint")

        self.logger.info(
                f"Checked mint requests in {(datetime.now() - started).seconds} second(s)"
            )

    def check_redeem_requests(self):
        started = datetime.now()

        for i, (_, tic) in enumerate(self.tics):
            redeemRequests = tic.functions.getRedeemRequests().call(
                    { "from": self.web3.eth.defaultAccount }
                )

            self.logger.info(f"Found {len(redeemRequests)} redeem request(s)")

            for redeem in redeemRequests:
                reject = False

                price_feed = self.tic_config["synthetics"][i]["price_feed"]
                request_time = redeem[1]
                ohlc = self.get_price_feed_ohlc(price_feed, request_time)

                if len(ohlc["c"]) > 0:
                    if price_feed == 'USDCHF':
                        price = 1/(ohlc["c"][0])
                    else:
                        price = ohlc["c"][0]

                    self.logger.info(f"{self.tic_config['synthetics'][i]['symbol']} was ${price} for redeem request {redeem[0].hex()}")

                    collateral = redeem[3][0]*(10**12)
                    tokens = redeem[4][0]

                    self.logger.info(f"Redeeming {tokens} tokens with {collateral} collateral")

                    if collateral <= tokens * price * (1 + self.max_slippage):
                        sender = redeem[2]
                        allowance = (self.synthetic_tokens[i].functions.allowance(sender, tic.address).call())
                        balance = (self.synthetic_tokens[i].functions.balanceOf(sender).call())

                        if balance >= tokens:
                            if allowance >= tokens:
                                self.resolve_request(redeem[0], tic.functions.approveRedeem, "Approved redeem")
                            else:
                                reject = True
                                self.logger.info(
                                        f"Unable to approve redeem request {redeem[0].hex()} until TIC is given an allowance to transfer the user's collateral"
                                    )
                        else:
                            reject = True
                            self.logger.info(f"Redeem request {redeem[0].hex()} is not covered by user's {self.tic_config['synthetics'][i]['symbol']} balance")
                    else:
                        reject = True
                        self.logger.info(f"Redeem request {redeem[0].hex()} is undercollateralized")
                else:
                    reject = True
                    self.logger.info("Forex is closed")

                if reject:
                    self.resolve_request(redeem[0], tic.functions.rejectRedeem, "Rejected redeem")

        self.logger.info(
                f"Checked redeem requests in {(datetime.now() - started).seconds} second(s)"
            )

    def check_exchange_requests(self):
        started = datetime.now()

        for i, (_, tic) in enumerate(self.tics):
            exchangeRequests = tic.functions.getExchangeRequests().call(
                    { "from": self.web3.eth.defaultAccount }
                )

            self.logger.info(f"Found {len(exchangeRequests)} exchange request(s)")

            for exchange in exchangeRequests:
                reject = False

                price_feed = self.tic_config["synthetics"][i]["price_feed"]
                request_time = exchange[1]
                ohlc = self.get_price_feed_ohlc(price_feed, request_time)

                if len(ohlc["c"]) > 0:
                    if price_feed == 'USDCHF':
                        price = 1/(ohlc["c"][0])
                    else:
                        price = ohlc["c"][0]

                    self.logger.info(f"{self.tic_config['synthetics'][i]['symbol']} was ${price} for exchange request {exchange[0].hex()}")

                    dest_tic = exchange[3]

                    dest_tic_index = None

                    for j, (address, _) in enumerate(self.tics):
                        if address == dest_tic:
                            dest_tic_index = j
                            break

                    if dest_tic_index == None:
                        self.logger.warning(f"No TIC configured for address {exchange[3]}")
                        continue

                    dest_price_feed = self.tic_config["synthetics"][dest_tic_index]["price_feed"]
                    dest_ohlc = self.get_price_feed_ohlc(dest_price_feed, request_time)

                    if len(dest_ohlc["c"]) > 0:
                        if price_feed == 'USDCHF':
                            dest_price = 1/(dest_ohlc["c"][0])
                        else:
                            dest_price = dest_ohlc["c"][0]

                        self.logger.info(f"{self.tic_config['synthetics'][dest_tic_index]['symbol']} was ${dest_price} for exchange request {exchange[0].hex()}")

                        tokens = exchange[4][0]
                        dest_tokens = exchange[6][0]

                        if tokens * price >= dest_tokens * dest_price * (1 - self.max_slippage):
                            sender = exchange[2]
                            allowance = self.synthetic_tokens[i].functions.allowance(sender, tic.address).call()
                            balance = self.synthetic_tokens[i].functions.balanceOf(sender).call()

                            if balance >= tokens:
                                if allowance >= tokens:
                                    self.resolve_request(exchange[0], tic.functions.approveExchange, "Approved exchange")
                                else:
                                    reject = True
                                    self.logger.info(
                                            f"Unable to approve exchange request {exchange[0].hex()} until TIC is given an allowance to transfer the user's tokens"
                                        )
                            else:
                                reject = True
                                self.logger.info(f"Exchange request {exchange[0].hex()} is not covered by user's {self.tic_config['synthetics'][i]['symbol']} balance")
                        else:
                            reject = True
                            self.logger.info(f"Exchange request {exchange[0].hex()} transfers too many destination tokens")
                    else:
                        reject = True
                        self.logger.info("Forex is closed")
                else:
                    reject = True
                    self.logger.info("Forex is closed")

                if reject:
                    self.resolve_request(exchange[0], tic.functions.rejectExchange, "Rejected exchange")

        self.logger.info(
                f"Checked exchange requests in {(datetime.now() - started).seconds} second(s)"
            )

    def get_price_feed_ohlc(self, price_feed, request_time):
        endpoint = "https://data.jarvis.exchange/jarvis/prices/history"

        query = f"?symbol={price_feed}&resolution=1&from={(request_time - 60)}&to={request_time}"

        response = requests.get(endpoint + query)

        return response.json()

    def resolve_request(self, request_id, resolve_callback, resolve_label):
        try:
            tx_hash = resolve_callback(request_id).transact(
                    { "from": self.web3.eth.defaultAccount }
                )
            tx_receipt = self.web3.eth.waitForTransactionReceipt(tx_hash)

            self.logger.info(
                    f"{resolve_label} request {request_id.hex()} in transaction {tx_hash.hex()}"
                )

        except BlockNotFound as err:
            self.logger.warning(err)

        except ValueError as err:
            self.logger.warning(err)
            self.logger.warning(f"Make sure there the LP has deposited enough the excess collateral required for the {resolve_label} request")

    @staticmethod
    def _run_future(future):
        def worker():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                asyncio.get_event_loop().run_until_complete(future)
            finally:
                loop.close()

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()


if __name__ == "__main__":
    SynFiatKeeper(sys.argv[1:]).main()
