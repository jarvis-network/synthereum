const TIC = artifacts.require("./TIC.sol");
const { expectRevert } = require("@openzeppelin/test-helpers");

contract("TIC", accounts => {
  const erc20ABI = [
    {
      "constant": true,
      "inputs": [],
      "name": "name",
      "outputs": [
        {
          "name": "",
          "type": "string"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "_spender",
          "type": "address"
        },
        {
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "totalSupply",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "_from",
          "type": "address"
        },
        {
          "name": "_to",
          "type": "address"
        },
        {
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "transferFrom",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "name": "",
          "type": "uint8"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "_owner",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "name": "balance",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "symbol",
      "outputs": [
        {
          "name": "",
          "type": "string"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "_to",
          "type": "address"
        },
        {
          "name": "_value",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "_owner",
          "type": "address"
        },
        {
          "name": "_spender",
          "type": "address"
        }
      ],
      "name": "allowance",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "payable": true,
      "stateMutability": "payable",
      "type": "fallback"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "owner",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "spender",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Approval",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event"
    }
  ];

  const daiAddr = "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa";

  it("should mint tokens when enough collateral is supplied.", async () => {
    if (await web3.eth.net.getId() === 42) {
      const dai = new web3.eth.Contract(erc20ABI, daiAddr);

      const tic = await TIC.deployed();
      const derivativeAddr = await tic.derivative();
      const derivative = new web3.eth.Contract(erc20ABI, derivativeAddr);

      await dai.methods.approve(tic.address, 12).send({
        from: accounts[0]
      });

      const balance = await derivative.methods.balanceOf(accounts[0]).call();

      await tic.deposit(2, { from: accounts[0] });
      await tic.mint(10, { from: accounts[0] });

      const newBalance = await derivative.methods.balanceOf(accounts[0]).call();

      assert.equal(newBalance - balance, 10);
    }
  });

  it("should not mint tokens when there is insufficient collateral.", async () => {
    if (await web3.eth.net.getId() === 42) {
      const dai = new web3.eth.Contract(erc20ABI, daiAddr);

      const tic = await TIC.deployed();
      const derivativeAddr = await tic.derivative();
      const derivative = new web3.eth.Contract(erc20ABI, derivativeAddr);

      await dai.methods.approve(tic.address, 11).send({
        from: accounts[0]
      });

      const balance = await derivative.methods.balanceOf(accounts[0]).call();

      await tic.deposit(1, { from: accounts[0] });

      await expectRevert.unspecified(tic.mint(10, { from: accounts[0] }));

      const newBalance = await derivative.methods.balanceOf(accounts[0]).call();

      assert.equal(newBalance - balance, 0);
    }
  });

  it("should mint tokens for multiple users when enough collateral is supplied.", async () => {
    if (await web3.eth.net.getId() === 42) {
      const dai = new web3.eth.Contract(erc20ABI, daiAddr);

      const tic = await TIC.deployed();
      const derivativeAddr = await tic.derivative();
      const derivative = new web3.eth.Contract(erc20ABI, derivativeAddr);

      await dai.methods.approve(tic.address, 14).send({
        from: accounts[0]
      });

      const balance1 = await derivative.methods.balanceOf(accounts[0]).call();

      await tic.deposit(2, { from: accounts[0] });
      await tic.mint(10, { from: accounts[0] });

      const newBalance1 = await derivative.methods.balanceOf(accounts[0]).call();

      assert.equal(newBalance1 - balance1, 10);

      const balance2 = await derivative.methods.balanceOf(accounts[1]).call();

      await dai.methods.approve(tic.address, 10).send({
        from: accounts[1]
      });

      await tic.deposit(2, { from: accounts[0] });
      await tic.mint(10, { from: accounts[1] });

      const newBalance2 = await derivative.methods.balanceOf(accounts[1]).call();

      assert.equal(newBalance2 - balance2, 10);
    }
  });

  it("should let a user redeem tokens after minting them.", async () => {
    if (await web3.eth.net.getId() === 42) {
      const dai = new web3.eth.Contract(erc20ABI, daiAddr);

      const tic = await TIC.deployed();
      const derivativeAddr = await tic.derivative();
      const derivative = new web3.eth.Contract(erc20ABI, derivativeAddr);

      const marginToApprove = web3.utils.toWei("0.12", "ether");
      await dai.methods.approve(tic.address, marginToApprove).send({
        from: accounts[0]
      });

      const balance = await derivative.methods.balanceOf(accounts[0]).call();

      const amountOfMargin = web3.utils.toWei("0.02", "ether");
      const amountOfSynTokens = web3.utils.toWei("0.1", "ether");
      await tic.deposit(amountOfMargin, { from: accounts[0] });
      await tic.mint(amountOfSynTokens, { from: accounts[0] });

      const newBalance = await derivative.methods.balanceOf(accounts[0]).call();
      const daiBalance = await dai.methods.balanceOf(accounts[0]).call();

      assert.equal(newBalance - balance, amountOfSynTokens);

      await derivative.methods.approve(tic.address, amountOfSynTokens).send({
        from: accounts[0]
      });
      await tic.redeemTokens(amountOfSynTokens, { from: accounts[0] });

      const afterRedeemBalance = await derivative.methods.balanceOf(accounts[0]).call();
      const newDaiBalance = await dai.methods.balanceOf(accounts[0]).call();

      assert.equal(newBalance - afterRedeemBalance, amountOfSynTokens);
      assert.equal(newDaiBalance - daiBalance, amountOfSynTokens);
    }
  });
});
