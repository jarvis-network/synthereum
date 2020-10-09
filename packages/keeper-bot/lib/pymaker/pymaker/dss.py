# This file is part of Maker Keeper Framework.
#
# Copyright (C) 2018-2019 bargst, EdNoepel
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

import logging
from collections import defaultdict
from datetime import datetime
from pprint import pformat
from typing import Optional, List

from hexbytes import HexBytes
from web3 import Web3

from web3._utils.events import get_event_data

from eth_abi.codec import ABICodec
from eth_abi.registry import registry as default_registry

from pymaker import Address, Contract, Transact
from pymaker.approval import directly, hope_directly
from pymaker.auctions import Flapper, Flipper, Flopper
from pymaker.gas import DefaultGasPrice
from pymaker.logging import LogNote
from pymaker.token import DSToken, ERC20Token
from pymaker.numeric import Wad, Ray, Rad


logger = logging.getLogger()


class Ilk:
    """Models one collateral type, the combination of a token and a set of risk parameters.
    For example, ETH-A and ETH-B are different collateral types with the same underlying token (WETH) but with
    different risk parameters.
    """

    def __init__(self, name: str, rate: Optional[Ray] = None,
                 ink: Optional[Wad] = None,
                 art: Optional[Wad] = None,
                 spot: Optional[Ray] = None,
                 line: Optional[Rad] = None,
                 dust: Optional[Rad] = None):
        assert (isinstance(name, str))
        assert (isinstance(rate, Ray) or (rate is None))
        assert (isinstance(ink, Wad) or (ink is None))
        assert (isinstance(art, Wad) or (art is None))
        assert (isinstance(spot, Ray) or (spot is None))
        assert (isinstance(line, Rad) or (line is None))
        assert (isinstance(dust, Rad) or (dust is None))

        self.name = name
        self.rate = rate
        self.ink = ink
        self.art = art
        self.spot = spot
        self.line = line
        self.dust = dust

    def toBytes(self):
        return Web3.toBytes(text=self.name).ljust(32, bytes(1))

    @staticmethod
    def fromBytes(ilk: bytes):
        assert (isinstance(ilk, bytes))

        name = Web3.toText(ilk.strip(bytes(1)))
        return Ilk(name)

    def __eq__(self, other):
        assert isinstance(other, Ilk)

        return (self.name == other.name) \
           and (self.rate == other.rate) \
           and (self.ink == other.ink) \
           and (self.art == other.art) \
           and (self.spot == other.spot) \
           and (self.line == other.line) \
           and (self.dust == other.dust)

    def __repr__(self):
        repr = ''
        if self.rate:
            repr += f' rate={self.rate}'
        if self.ink:
            repr += f' Ink={self.ink}'
        if self.art:
            repr += f' Art={self.art}'
        if self.spot:
            repr += f' spot={self.spot}'
        if self.line:
            repr += f' line={self.line}'
        if self.dust:
            repr += f' dust={self.dust}'
        if repr:
            repr = f'[{repr.strip()}]'

        return f"Ilk('{self.name}'){repr}"


class Urn:
    """Models one CDP for a single collateral type and account.  Note the "address of the Urn" is merely the address
    of the CDP holder.
    """

    def __init__(self, address: Address, ilk: Ilk = None, ink: Wad = None, art: Wad = None):
        assert isinstance(address, Address)
        assert isinstance(ilk, Ilk) or (ilk is None)
        assert isinstance(ink, Wad) or (ink is None)
        assert isinstance(art, Wad) or (art is None)

        self.address = address
        self.ilk = ilk
        self.ink = ink
        self.art = art

    def toBytes(self):
        addr_str = self.address.address
        return Web3.toBytes(hexstr='0x' + addr_str[2:].zfill(64))

    @staticmethod
    def fromBytes(urn: bytes):
        assert isinstance(urn, bytes)

        address = Address(Web3.toHex(urn[-20:]))
        return Urn(address)

    def __eq__(self, other):
        assert isinstance(other, Urn)

        return (self.address == other.address) and (self.ilk == other.ilk)

    def __repr__(self):
        repr = ''
        if self.ilk:
            repr += f'[{self.ilk.name}]'
        if self.ink:
            repr += f' ink={self.ink}'
        if self.art:
            repr += f' art={self.art}'
        if repr:
            repr = f'[{repr.strip()}]'
        return f"Urn('{self.address}'){repr}"


class Join(Contract):
    def __init__(self, web3: Web3, address: Address):
        assert isinstance(web3, Web3)
        assert isinstance(address, Address)

        self.web3 = web3
        self.address = address
        self._contract = self._get_contract(web3, self.abi, address)
        self._token: DSToken = None

    def approve(self, approval_function, source: Address):
        assert(callable(approval_function))
        assert isinstance(source, Address)

        approval_function(ERC20Token(web3=self.web3, address=source), self.address, self.__class__.__name__)

    def approve_token(self, approval_function, **kwargs):
        return self.approve(approval_function, self._token.address, **kwargs)

    def join(self, usr: Address, value: Wad) -> Transact:
        assert isinstance(usr, Address)
        assert isinstance(value, Wad)

        return Transact(self, self.web3, self.abi, self.address, self._contract,
                        'join', [usr.address, value.value])

    def exit(self, usr: Address, value: Wad) -> Transact:
        assert isinstance(usr, Address)
        assert isinstance(value, Wad)

        return Transact(self, self.web3, self.abi, self.address, self._contract,
                        'exit', [usr.address, value.value])


class DaiJoin(Join):
    """A client for the `DaiJoin` contract, which allows the CDP holder to draw Dai from their Urn and repay it.

    Ref. <https://github.com/makerdao/dss/blob/master/src/join.sol>
    """

    abi = Contract._load_abi(__name__, 'abi/DaiJoin.abi')
    bin = Contract._load_bin(__name__, 'abi/DaiJoin.bin')

    def __init__(self, web3: Web3, address: Address):
        super(DaiJoin, self).__init__(web3, address)
        self._token = self.dai()

    def dai(self) -> DSToken:
        address = Address(self._contract.functions.dai().call())
        return DSToken(self.web3, address)


class GemJoin(Join):
    """A client for the `GemJoin` contract, which allows the user to deposit collateral into a new or existing vault.

    Ref. <https://github.com/makerdao/dss/blob/master/src/join.sol>
    """

    abi = Contract._load_abi(__name__, 'abi/GemJoin.abi')
    bin = Contract._load_bin(__name__, 'abi/GemJoin.bin')

    def __init__(self, web3: Web3, address: Address):
        super(GemJoin, self).__init__(web3, address)
        self._token = self.gem()

    def ilk(self):
        return Ilk.fromBytes(self._contract.functions.ilk().call())

    def gem(self) -> DSToken:
        address = Address(self._contract.functions.gem().call())
        return DSToken(self.web3, address)

    def dec(self) -> int:
        return 18


class GemJoin5(GemJoin):
    """A client for the `GemJoin5` contract, which allows the user to deposit collateral into a new or existing vault.

    Ref. <https://github.com/makerdao/dss-deploy/blob/master/src/join.sol#L274>
    """
    abi = Contract._load_abi(__name__, 'abi/GemJoin5.abi')
    bin = Contract._load_bin(__name__, 'abi/GemJoin5.bin')

    def __init__(self, web3: Web3, address: Address):
        super(GemJoin5, self).__init__(web3, address)
        self._token = self.gem()

    def dec(self) -> int:
        return int(self._contract.functions.dec().call())


class Collateral:
    """The `Collateral` object wraps accounting information in the Ilk with token-wide artifacts shared across
    multiple collateral types for the same token.  For example, ETH-A and ETH-B are represented by different Ilks,
    but will share the same gem (WETH token), GemJoin instance, and Flipper contract.
    """

    def __init__(self, ilk: Ilk, gem: ERC20Token, adapter: GemJoin, flipper: Flipper, pip):
        assert isinstance(ilk, Ilk)
        assert isinstance(gem, ERC20Token)
        assert isinstance(adapter, GemJoin)
        assert isinstance(flipper, Flipper)

        self.ilk = ilk
        self.gem = gem
        self.adapter = adapter
        self.flipper = flipper
        # Points to `median` for official deployments, `DSValue` for testing purposes.
        # Users generally have no need to interact with the pip.
        self.pip = pip

    def approve(self, usr: Address, **kwargs):
        """
        Allows the user to move this collateral into and out of their CDP.

        Args
            usr: User making transactions with this collateral
        """
        gas_price = kwargs['gas_price'] if 'gas_price' in kwargs else DefaultGasPrice()
        self.adapter.approve(hope_directly(from_address=usr, gas_price=gas_price), self.flipper.vat())
        self.adapter.approve_token(directly(from_address=usr, gas_price=gas_price))


class Vat(Contract):
    """A client for the `Vat` contract, which manages accounting for all Urns (CDPs).

    Ref. <https://github.com/makerdao/dss/blob/master/src/vat.sol>
    """

    # Identifies CDP holders and collateral types they have frobbed
    class LogFrob():
        def __init__(self, lognote: LogNote):
            assert isinstance(lognote, LogNote)

            self.ilk = str(Web3.toText(lognote.arg1)).replace('\x00', '')
            self.urn = Address(Web3.toHex(lognote.arg2)[26:])
            self.collateral_owner = Address(Web3.toHex(lognote.arg3)[26:])
            self.dai_recipient = Address(Web3.toHex(lognote.get_bytes_at_index(3))[26:])
            self.dink = Wad(int.from_bytes(lognote.get_bytes_at_index(4), byteorder="big", signed=True))
            self.dart = Wad(int.from_bytes(lognote.get_bytes_at_index(5), byteorder="big", signed=True))
            self.block = lognote.block
            self.tx_hash = lognote.tx_hash

        def __repr__(self):
            return f"LogFrob({pformat(vars(self))})"

    abi = Contract._load_abi(__name__, 'abi/Vat.abi')
    bin = Contract._load_bin(__name__, 'abi/Vat.bin')

    def __init__(self, web3: Web3, address: Address):
        assert isinstance(web3, Web3)
        assert isinstance(address, Address)

        self.web3 = web3
        self.address = address
        self._contract = self._get_contract(web3, self.abi, address)

    def init(self, ilk: Ilk) -> Transact:
        assert isinstance(ilk, Ilk)

        return Transact(self, self.web3, self.abi, self.address, self._contract, 'init', [ilk.toBytes()])

    def live(self) -> bool:
        return self._contract.functions.live().call() > 0

    def wards(self, address: Address):
        assert isinstance(address, Address)

        return bool(self._contract.functions.wards(address.address).call())

    def hope(self, address: Address):
        assert isinstance(address, Address)

        return Transact(self, self.web3, self.abi, self.address, self._contract, 'hope', [address.address])

    def can(self, sender: Address, usr: Address):
        assert isinstance(sender, Address)
        assert isinstance(usr, Address)

        return bool(self._contract.functions.can(sender.address, usr.address).call())

    def ilk(self, name: str) -> Ilk:
        assert isinstance(name, str)

        b32_ilk = Ilk(name).toBytes()
        (art, rate, spot, line, dust) = self._contract.functions.ilks(b32_ilk).call()

        # We could get "ink" from the urn, but caller must provide an address.
        return Ilk(name, rate=Ray(rate), ink=Wad(0), art=Wad(art), spot=Ray(spot), line=Rad(line), dust=Rad(dust))

    def gem(self, ilk: Ilk, urn: Address) -> Wad:
        assert isinstance(ilk, Ilk)
        assert isinstance(urn, Address)

        return Wad(self._contract.functions.gem(ilk.toBytes(), urn.address).call())

    def dai(self, urn: Address) -> Rad:
        assert isinstance(urn, Address)

        return Rad(self._contract.functions.dai(urn.address).call())

    def sin(self, urn: Address) -> Rad:
        assert isinstance(urn, Address)

        return Rad(self._contract.functions.sin(urn.address).call())

    def urn(self, ilk: Ilk, address: Address) -> Urn:
        assert isinstance(ilk, Ilk)
        assert isinstance(address, Address)

        (ink, art) = self._contract.functions.urns(ilk.toBytes(), address.address).call()
        return Urn(address, ilk, Wad(ink), Wad(art))

    def urns(self, ilk=None, from_block=0) -> dict:
        """Retrieve a collection of Urns indexed by Ilk.name and then Urn address

        Args:
            ilk: Optionally filter results by ilk.name.
            from_block: Filter urns adjusted on or after the specified block.
        """
        assert isinstance(ilk, Ilk) or ilk is None
        assert isinstance(from_block, int)

        urn_keys = set()
        urns = defaultdict(dict)

        number_of_past_blocks = self._contract.web3.eth.blockNumber - from_block
        logfrobs = self.past_frobs(number_of_past_blocks, ilk)
        for frob in logfrobs:
            urn_keys.add((frob.ilk, frob.urn))
        for urn_key in urn_keys:
            ilk = urn_key[0]
            urn = urn_key[1]
            urns[ilk][urn] = self.urn(Ilk(ilk), urn)

        return urns

    def debt(self) -> Rad:
        return Rad(self._contract.functions.debt().call())

    def vice(self) -> Rad:
        return Rad(self._contract.functions.vice().call())

    def line(self) -> Rad:
        """ Total debt ceiling """
        return Rad(self._contract.functions.Line().call())

    def flux(self, ilk: Ilk, src: Address, dst: Address, wad: Wad) -> Transact:
        """Move Ilk balance in Vat from source address to destiny address

        Args:
            ilk: Identifies the type of collateral.
            src: Source of the collateral (address of the source).
            dst: Destiny of the collateral (address of the recipient).
            wad: Amount of collateral to move.
        """
        assert isinstance(ilk, Ilk)
        assert isinstance(src, Address)
        assert isinstance(dst, Address)
        assert isinstance(wad, Wad)

        flux_args = [ilk.toBytes(), src.address, dst.address, wad.value]
        return Transact(self, self.web3, self.abi, self.address, self._contract, 'flux', flux_args)

    def move(self, src: Address, dst: Address, rad: Rad) -> Transact:
        """Move Dai balance in Vat from source address to destiny address

        Args:
            src: Source of the dai (address of the source).
            dst: Destiny of the dai (address of the recipient).
            rad: Amount of dai to move.
        """
        assert isinstance(src, Address)
        assert isinstance(dst, Address)
        assert isinstance(rad, Rad)

        move_args = [src.address, dst.address, rad.value]
        return Transact(self, self.web3, self.abi, self.address, self._contract, 'move', move_args)

    def fork(self, ilk: Ilk, src: Address, dst: Address, dink: Wad, dart: Wad) -> Transact:
        """Split a Vault - binary approval or splitting/merging Vault's

        Args:
            ilk: Identifies the type of collateral.
            src: Address of the source Urn.
            dst: Address of the destiny Urn.
            dink: Amount of collateral to exchange.
            dart: Amount of stable coin debt to exchange.
        """
        assert isinstance(ilk, Ilk)
        assert isinstance(src, Address)
        assert isinstance(dst, Address)
        assert isinstance(dink, Wad)
        assert isinstance(dart, Wad)

        fork_args = [ilk.toBytes(), src.address, dst.address, dink.value, dart.value]
        return Transact(self, self.web3, self.abi, self.address, self._contract, 'fork', fork_args)

    def frob(self, ilk: Ilk, urn_address: Address, dink: Wad, dart: Wad, collateral_owner=None, dai_recipient=None):
        """Adjust amount of collateral and reserved amount of Dai for the CDP

        Args:
            ilk: Identifies the type of collateral.
            urn_address: CDP holder (address of the Urn).
            dink: Amount of collateral to add/remove.
            dart: Adjust CDP debt (amount of Dai available for borrowing).
            collateral_owner: Holder of the collateral used to fund the CDP.
            dai_recipient: Party receiving the Dai.
        """
        assert isinstance(ilk, Ilk)
        assert isinstance(urn_address, Address)
        assert isinstance(dink, Wad)
        assert isinstance(dart, Wad)
        assert isinstance(collateral_owner, Address) or (collateral_owner is None)
        assert isinstance(dai_recipient, Address) or (dai_recipient is None)

        # Usually these addresses are the same as the account holding the urn
        v = collateral_owner or urn_address
        w = dai_recipient or urn_address
        assert isinstance(v, Address)
        assert isinstance(w, Address)

        self.validate_frob(ilk, urn_address, dink, dart)

        if v == urn_address and w == urn_address:
            logger.info(f"frobbing {ilk.name} urn {urn_address.address} with dink={dink}, dart={dart}")
        else:
            logger.info(f"frobbing {ilk.name} urn {urn_address.address} "
                        f"with dink={dink} from {v.address}, "
                        f"dart={dart} for {w.address}")

        return Transact(self, self.web3, self.abi, self.address, self._contract,
                        'frob', [ilk.toBytes(), urn_address.address, v.address, w.address, dink.value, dart.value])

    def validate_frob(self, ilk: Ilk, address: Address, dink: Wad, dart: Wad):
        """Helps diagnose `frob` transaction failures by asserting on `require` conditions in the contract"""
        assert isinstance(ilk, Ilk)
        assert isinstance(address, Address)
        assert isinstance(dink, Wad)
        assert isinstance(dart, Wad)

        urn = self.urn(ilk, address)
        ilk = self.ilk(ilk.name)

        logger.debug(f"urn.ink={urn.ink}, urn.art={urn.art}, dink={dink}, dart={dart}, "
                     f"ilk.rate={ilk.rate}, debt={str(self.debt())}")
        ink = urn.ink + dink
        art = urn.art + dart
        ilk_art = ilk.art + dart
        rate = ilk.rate

        gem = self.gem(ilk, urn.address) - dink
        dai = self.dai(urn.address) + Rad(rate * dart)
        debt = self.debt() + Rad(rate * dart)

        # stablecoin debt does not increase
        cool = dart <= Wad(0)
        # collateral balance does not decrease
        firm = dink >= Wad(0)
        nice = cool and firm

        # Vault remains under both collateral and total debt ceilings
        under_collateral_debt_ceiling = Rad(ilk_art * rate) <= ilk.line
        if not under_collateral_debt_ceiling:
            logger.warning(f"Vault would exceed collateral debt ceiling of {ilk.line}")
        under_total_debt_ceiling = debt < self.line()
        if not under_total_debt_ceiling:
            logger.warning(f"Vault would exceed total debt ceiling of {self.line()}")
        calm = under_collateral_debt_ceiling and under_total_debt_ceiling

        safe = (urn.art * rate) <= ink * ilk.spot

        assert calm or cool
        assert nice or safe

        assert Rad(ilk_art * rate) >= ilk.dust or (art == Wad(0))
        assert rate != Ray(0)
        assert self.live()

    def past_frobs(self, number_of_past_blocks: int, ilk=None) -> List[LogFrob]:
        """Synchronously retrieve a list showing which ilks and urns have been frobbed.
         Args:
            number_of_past_blocks: Number of past Ethereum blocks to retrieve the events from.
            ilk: Optionally filter frobs by ilk.name
         Returns:
            List of past `LogFrob` events represented as :py:class:`pymaker.dss.Vat.LogFrob` class.
        """
        assert isinstance(number_of_past_blocks, int)
        assert isinstance(ilk, Ilk) or ilk is None

        block_number = self._contract.web3.eth.blockNumber
        filter_params = {
            'address': self.address.address,
            'fromBlock': max(block_number-number_of_past_blocks, 0),
            'toBlock': block_number
        }

        logs = self.web3.eth.getLogs(filter_params)

        lognotes = list(map(lambda l: LogNote.from_event(l, Vat.abi), logs))
        # '0x7cdd3fde' is Vat.slip (from GemJoin.join) and '0x76088703' is Vat.frob
        logfrobs = list(filter(lambda l: l.sig == '0x76088703', lognotes))
        logfrobs = list(map(lambda l: Vat.LogFrob(l), logfrobs))

        if ilk is not None:
            logfrobs = list(filter(lambda l: l.ilk == ilk.name, logfrobs))

        return logfrobs

    def heal(self, vice: Rad) -> Transact:
        assert isinstance(vice, Rad)

        return Transact(self, self.web3, self.abi, self.address, self._contract, 'heal', [vice.value])

    def __eq__(self, other):
        assert isinstance(other, Vat)
        return self.address == other.address

    def __repr__(self):
        return f"Vat('{self.address}')"


class Spotter(Contract):
    """A client for the `Spotter` contract, which interacts with Vat for the purpose of managing collateral prices.
    Users generally have no need to interact with this contract; it is included for unit testing purposes.

    Ref. <https://github.com/makerdao/dss-deploy/blob/master/src/poke.sol>
    """

    abi = Contract._load_abi(__name__, 'abi/Spotter.abi')
    bin = Contract._load_bin(__name__, 'abi/Spotter.bin')

    def __init__(self, web3: Web3, address: Address):
        assert isinstance(web3, Web3)
        assert isinstance(address, Address)

        self.web3 = web3
        self.address = address
        self._contract = self._get_contract(web3, self.abi, address)

    def poke(self, ilk: Ilk) -> Transact:
        assert isinstance(ilk, Ilk)

        return Transact(self, self.web3, self.abi, self.address, self._contract, 'poke', [ilk.toBytes()])

    def vat(self) -> Address:
        return Address(self._contract.functions.vat().call())

    def par(self) -> Ray:
        return Ray(self._contract.functions.par().call())

    def mat(self, ilk: Ilk) -> Ray:
        assert isinstance(ilk, Ilk)
        (pip, mat) = self._contract.functions.ilks(ilk.toBytes()).call()

        return Ray(mat)

    def __repr__(self):
        return f"Spotter('{self.address}')"


class Vow(Contract):
    """A client for the `Vow` contract, which manages liquidation of surplus Dai and settlement of collateral debt.
    Specifically, this contract is useful for Flap and Flop auctions.

    Ref. <https://github.com/makerdao/dss/blob/master/src/heal.sol>
    """

    abi = Contract._load_abi(__name__, 'abi/Vow.abi')
    bin = Contract._load_bin(__name__, 'abi/Vow.bin')

    def __init__(self, web3: Web3, address: Address):
        assert isinstance(web3, Web3)
        assert isinstance(address, Address)

        self.web3 = web3
        self.address = address
        self._contract = self._get_contract(web3, self.abi, address)
        self.vat = Vat(web3, Address(self._contract.functions.vat().call()))

    def rely(self, guy: Address) -> Transact:
        assert isinstance(guy, Address)

        return Transact(self, self.web3, self.abi, self.address, self._contract, 'rely', [guy.address])

    def live(self) -> bool:
        return self._contract.functions.live().call() > 0

    def flapper(self) -> Address:
        return Address(self._contract.functions.flapper().call())

    def flopper(self) -> Address:
        return Address(self._contract.functions.flopper().call())

    def sin(self) -> Rad:
        return Rad(self._contract.functions.Sin().call())

    def sin_of(self, era: int) -> Rad:
        return Rad(self._contract.functions.sin(era).call())

    def ash(self) -> Rad:
        return Rad(self._contract.functions.Ash().call())

    def woe(self) -> Rad:
        return (self.vat.sin(self.address) - self.sin()) - self.ash()

    def wait(self) -> int:
        return int(self._contract.functions.wait().call())

    def dump(self) -> Wad:
        return Wad(self._contract.functions.dump().call())

    def sump(self) -> Rad:
        return Rad(self._contract.functions.sump().call())

    def bump(self) -> Rad:
        return Rad(self._contract.functions.bump().call())

    def hump(self) -> Rad:
        return Rad(self._contract.functions.hump().call())

    def flog(self, era: int) -> Transact:
        assert isinstance(era, int)

        return Transact(self, self.web3, self.abi, self.address, self._contract, 'flog', [era])

    def heal(self, rad: Rad) -> Transact:
        assert isinstance(rad, Rad)
        logger.info(f"Healing joy={self.vat.dai(self.address)} woe={self.woe()}")

        return Transact(self, self.web3, self.abi, self.address, self._contract, 'heal', [rad.value])

    def kiss(self, rad: Rad) -> Transact:
        assert isinstance(rad, Rad)

        return Transact(self, self.web3, self.abi, self.address, self._contract, 'kiss', [rad.value])

    def flop(self) -> Transact:
        """Initiate a debt auction"""
        logger.info(f"Initiating a flop auction with woe={self.woe()}")

        return Transact(self, self.web3, self.abi, self.address, self._contract, 'flop', [])

    def flap(self) -> Transact:
        """Initiate a surplus auction"""
        logger.info(f"Initiating a flap auction with joy={self.vat.dai(self.address)}")

        return Transact(self, self.web3, self.abi, self.address, self._contract, 'flap', [])

    def __repr__(self):
        return f"Vow('{self.address}')"


class Jug(Contract):
    """A client for the `Jug` contract, which manages stability fees.

    Ref. <https://github.com/makerdao/dss/blob/master/src/jug.sol>
    """

    abi = Contract._load_abi(__name__, 'abi/Jug.abi')
    bin = Contract._load_bin(__name__, 'abi/Jug.bin')

    def __init__(self, web3: Web3, address: Address):
        assert isinstance(web3, Web3)
        assert isinstance(address, Address)

        self.web3 = web3
        self.address = address
        self._contract = self._get_contract(web3, self.abi, address)
        self.vat = Vat(web3, Address(self._contract.functions.vat().call()))
        self.vow = Vow(web3, Address(self._contract.functions.vow().call()))

    def init(self, ilk: Ilk) -> Transact:
        assert isinstance(ilk, Ilk)

        return Transact(self, self.web3, self.abi, self.address, self._contract, 'init', [ilk.toBytes()])

    def wards(self, address: Address):
        assert isinstance(address, Address)

        return bool(self._contract.functions.wards(address.address).call())

    def drip(self, ilk: Ilk) -> Transact:
        assert isinstance(ilk, Ilk)

        return Transact(self, self.web3, self.abi, self.address, self._contract, 'drip', [ilk.toBytes()])

    def base(self) -> Wad:
        return Wad(self._contract.functions.base().call())

    def duty(self, ilk: Ilk) -> Ray:
        assert isinstance(ilk, Ilk)

        return Ray(self._contract.functions.ilks(ilk.toBytes()).call()[0])

    def rho(self, ilk: Ilk) -> int:
        assert isinstance(ilk, Ilk)

        return Web3.toInt(self._contract.functions.ilks(ilk.toBytes()).call()[1])

    def __repr__(self):
        return f"Jug('{self.address}')"


class Cat(Contract):
    """A client for the `Cat` contract, used to liquidate unsafe Urns (CDPs).
    Specifically, this contract is useful for Flip auctions.

    Ref. <https://github.com/makerdao/dss/blob/master/src/cat.sol>
    """

    # This information is read from the `Bite` event emitted from `Cat.bite`
    class LogBite:
        def __init__(self, log):
            self.ilk = Ilk.fromBytes(log['args']['ilk'])
            self.urn = Urn(Address(log['args']['urn']))
            self.ink = Wad(log['args']['ink'])
            self.art = Wad(log['args']['art'])
            self.tab = Rad(log['args']['tab'])
            self.flip = Address(log['args']['flip'])
            self.raw = log

        @classmethod
        def from_event(cls, event: dict):
            assert isinstance(event, dict)

            topics = event.get('topics')
            if topics and topics[0] == HexBytes('0x99b5620489b6ef926d4518936cfec15d305452712b88bd59da2d9c10fb0953e8'):
                log_bite_abi = [abi for abi in Cat.abi if abi.get('name') == 'Bite'][0]
                codec = ABICodec(default_registry)
                event_data = get_event_data(codec, log_bite_abi, event)

                return Cat.LogBite(event_data)
            else:
                logging.warning(f'[from_event] Invalid topic in {event}')

        def era(self, web3: Web3):
            return web3.eth.getBlock(self.raw['blockNumber'])['timestamp']

        def __eq__(self, other):
            assert isinstance(other, Cat.LogBite)
            return self.__dict__ == other.__dict__

        def __repr__(self):
            return pformat(vars(self))

    abi = Contract._load_abi(__name__, 'abi/Cat.abi')
    bin = Contract._load_bin(__name__, 'abi/Cat.bin')

    def __init__(self, web3: Web3, address: Address):
        assert isinstance(web3, Web3)
        assert isinstance(address, Address)

        self.web3 = web3
        self.address = address
        self._contract = self._get_contract(web3, self.abi, address)
        self.vat = Vat(web3, Address(self._contract.functions.vat().call()))
        self.vow = Vow(web3, Address(self._contract.functions.vow().call()))

    def live(self) -> bool:
        return self._contract.functions.live().call() > 0

    def bite(self, ilk: Ilk, urn: Urn) -> Transact:
        """ Initiate liquidation of a CDP, kicking off a flip auction

        Args:
            ilk: Identifies the type of collateral.
            urn: Address of the CDP holder.
        """
        assert isinstance(ilk, Ilk)
        assert isinstance(urn, Urn)

        ilk = self.vat.ilk(ilk.name)
        urn = self.vat.urn(ilk, urn.address)
        rate = self.vat.ilk(ilk.name).rate
        logger.info(f'Biting {ilk.name} CDP {urn.address.address} with ink={urn.ink} spot={ilk.spot} '
                    f'art={urn.art} rate={rate}')

        return Transact(self, self.web3, self.abi, self.address, self._contract,
                        'bite', [ilk.toBytes(), urn.address.address])

    def lump(self, ilk: Ilk) -> Wad:
        assert isinstance(ilk, Ilk)

        (flip, chop, lump) = self._contract.functions.ilks(ilk.toBytes()).call()
        return Wad(lump)

    def chop(self, ilk: Ilk) -> Ray:
        assert isinstance(ilk, Ilk)

        (flip, chop, lump) = self._contract.functions.ilks(ilk.toBytes()).call()
        return Ray(chop)

    def file_vow(self, vow: Vow) -> Transact:
        assert isinstance(vow, Vow)

        return Transact(self, self.web3, self.abi, self.address, self._contract,
                        'file(bytes32,address)', [Web3.toBytes(text="vow"), vow.address.address])

    def flipper(self, ilk: Ilk) -> Address:
        assert isinstance(ilk, Ilk)

        (flip, chop, lump) = self._contract.functions.ilks(ilk.toBytes()).call()
        return Address(flip)

    def past_bites(self, number_of_past_blocks: int, event_filter: dict = None) -> List[LogBite]:
        """Synchronously retrieve past LogBite events.

        `LogBite` events are emitted every time someone bites a CDP.

        Args:
            number_of_past_blocks: Number of past Ethereum blocks to retrieve the events from.
            event_filter: Filter which will be applied to returned events.

        Returns:
            List of past `LogBite` events represented as :py:class:`pymaker.dss.Cat.LogBite` class.
        """
        assert isinstance(number_of_past_blocks, int)
        assert isinstance(event_filter, dict) or (event_filter is None)

        return self._past_events(self._contract, 'Bite', Cat.LogBite, number_of_past_blocks, event_filter)

    def __repr__(self):
        return f"Cat('{self.address}')"


class Pot(Contract):
    """A client for the `Pot` contract, which implements the DSR.

    Ref. <https://github.com/makerdao/dss/blob/master/src/pot.sol>
    """

    abi = Contract._load_abi(__name__, 'abi/Pot.abi')
    bin = Contract._load_bin(__name__, 'abi/Pot.bin')

    def __init__(self, web3: Web3, address: Address):
        assert isinstance(web3, Web3)
        assert isinstance(address, Address)

        self.web3 = web3
        self.address = address
        self._contract = self._get_contract(web3, self.abi, address)

    def approve(self, source: Address, approval_function, **kwargs):
        """Approve the pot to access Dai from our Urns"""
        assert isinstance(source, Address)
        assert(callable(approval_function))

        approval_function(ERC20Token(web3=self.web3, address=source), self.address, self.__class__.__name__, **kwargs)

    def pie_of(self, address: Address) -> Wad:
        assert isinstance(address, Address)
        return Wad(self._contract.functions.pie(address.address).call())

    def pie(self) -> Wad:
        pie = self._contract.functions.Pie().call()
        return Wad(pie)

    def dsr(self) -> Ray:
        dsr = self._contract.functions.dsr().call()
        return Ray(dsr)

    def chi(self) -> Ray:
        chi = self._contract.functions.chi().call()
        return Ray(chi)

    def rho(self) -> datetime:
        rho = self._contract.functions.rho().call()
        return datetime.fromtimestamp(rho)

    def drip(self) -> Transact:
        return Transact(self, self.web3, self.abi, self.address, self._contract, 'drip', [])

    """Note that join requires use of proxy contract, so join/exit are not provided here."""

    def __repr__(self):
        return f"Pot('{self.address}')"
