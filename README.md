# Jarvis Exchange | Synthereum

Built on top of the priceless contracts developed by [UMA](https://docs.umaproject.org/uma/index.html).

<!-- markdownlint-disable no-inline-html -->

## Getting started - development environment setup

<details>
<summary><b>Requirements for manual setup</b></summary>

We strongly recommend using [**Nix**](https://nixos.org/) to manage the system dependencies, so you can skip to [setting up Nix below](#nix_setup).

However, if you prefer to not set up Nix, you need to install the following:

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/) [LTS (currently v14)](https://nodejs.org/en/about/releases/) (later versions may also work, but that's not verified)
* [Yarn](https://classic.yarnpkg.com/lang/en/) (could be installed via npm: `npm install -g yarn` or though your OS' package manager)
* [Python 3](https://www.python.org/)
* [Docker](https://www.docker.com/)
* [Docker Compose](https://docs.docker.com/compose/)

Please consult the manual of your system package manager for instructions on
installing the software listed above.

</details>

### <a name="nix_setup"></a> Setting up a development environment via Nix, Nix Flakes and direnv

1. Clone the project:

    <details>
    <summary>
    Via SSH (if you have a GitLab account and you have
    <a href="https://docs.gitlab.com/ee/ssh/">
    added your SSH keys to it
    </a>)
    </summary>

    ```sh
    git clone git@gitlab.com:jarvis-network/apps/exchange/mono-repo.git
    ```

    </details>

    <details>
    <summary>Via HTTPS</summary>

    ```sh
    git clone https://gitlab.com/jarvis-network/apps/exchange/mono-repo.git
    ```

    </details>

2. [Install Nix, enable nix-flake support and configure direnv](./docs/install-nix.md)

3. Build the project:
    1. Enter the development shell:

        * If you have `direnv` installed, you just need to allow it to evaluate the `.envrc` file in the current folder:

            ```sh
            direnv allow .
            ```

        * If you don't have `direnv` installed (or you prefer not to use it), run:

            ```sh
            nix develop
            ```

    2. Install `Node.js` dependencies via `yarn` (**`npm` is not supported**):

        ```sh
        yarn
        ```

    3. Build all libraries and applications:

        ```sh
        yarn build:all
        ```

        Or just part that you're interested in (including its dependencies):

        * Frontend:

            ```sh
            yarn build frontend
            ```

        * Borrowing:

            ```sh
            yarn build borrowing
            ```

        * Claim:

            ```sh
            yarn build claim
            ```

        * Validator:

            ```sh
            yarn build validator
            ```

        * CLI utils:

            ```sh
            yarn build cli
            ```

    4. Start it:

        * Jarvis Exchange DApp:

            ```sh
            yarn start frontend
            ```

        * Jarvis Borrowing (Self Minting) DApp:

            ```sh
            yarn start frontend
            ```

        * Jarvis Claim JRT DApp:

            ```sh
            yarn start claim
            ```

        * Validator:

            ```sh
            yarn start validator
            ```

        * CLI utils:

            ```sh
            yarn start cli
            ```

</details>

## Project structure

```txt
jarvis-network/exchange/mono-repo/
├── apps/                    | source code | applications
│   ├── borrowing/           | source code | Jarvis Borrowing DApp
│   ├── claim/               | source code | Jarvis Claim DApp
│   ├── cli/                 | source code | CLI utilities for interacting with contracts
│   ├── frontend/            | source code | Jarvis Exchange DApp
│   ├── validator/           | source code | double tx based mint/redeem/exchange validator (Synthereum V1)
│   └── validator-meta-tx/   | source code | meta-tx based mint/redeem/exchange validator (Synthereum V2)
├── libs/                    | source code | libraries (on which the applications depend)
│   ├── contracts/           | source code | Synthereum Solidity implementation
│   ├── core-utils/          | source code | @jarvis-network/core-utils - core utility library
│   ├── toolkit/             | source code | @jarvis-network/app-toolkit - reusable frontend code
│   ├── ui/                  | source code | @jarvis-network/ui - implements reusable React.js UI components
│   └── validator-lib/       | source code | @jarvis-network/validator-lib
│
├── scripts/                 | scripts | development utility scripts
│   ├── build_frontend.bash
│   ├── check_commit_range.bash
│   ├── ci_test_affected.bash
│   ├── prepare-release.bash
│   └── repo-cleanup-post-part-1-of-nx.dev-changes.bash
│
├── helm/                    | helm | Helm deployment Charts
│   └── validator            | helm
│
├── README.md                | docs | this file
├── LICENSE                  | docs | MIT license
├── docs/                    | docs
│   ├── security-audits/     | docs
│   ├── fee-calculations.md  | docs
│   └── install-nix.md       | docs
│
├── .envrc                   | nix | direnv config file; takes care of sourcing nix env variables
├── flake.nix                | nix | Nix Flake file
├── flake.lock               | nix | Nix Flake lock file
├── shell.nix                | nix | Nix build-inputs (system dependencies) file
│
├── .npmrc                   | yarn | npm publish config
├── package.json             | yarn | workspace root package.json
├── yarn.lock                | yarn | lock file
├── .yarnrc                  | yarn | config file
│
├── nx.json                  | nx | (mono repo dev tools) config
├── workspace.json           | nx
│
├── docker-bake.hcl          | docker | Docker Buildx config
├── Dockerfile               | docker | Dockerfile containing all image targets
├── .dockerignore            | docker | Docker ignore file
│
├── .gitignore               | git | list of files ignored by git
├── CODEOWNERS               | gitlab | GitLab merge request approvals config
├── .gitlab-ci.yml           | gitlab | config for GitLab CI/CD
│
├── netlify.toml             | netlify | URL redirects and rewrites
│
├── commitlint.config.js     | code style | commit message lint config
├── .editorconfig            | code style | general editor config
├── .eslintrc.json           | code style | ESLint
├── .prettierrc              | code style | Prettier
├── .prettierignore          | code style | Prettier
│
├── jest.config.js           | jest | Jest test framework config
├── jest.preset.js           | jest
│
├── tsconfig.base.json       | typescript | base TypeScript config (shared by the whole repo)
├── tsconfig.cli.json        | typescript | config for CLI programs (inherits the base one)
├── tsconfig.frontend.json   | typescript | config for frontend apps (inherits the base one)
└── tsconfig.node.json       | typescript | config for Node.js apps (inherits the base one)
```

## Environment Variables

Running applications or scripts may require setting environment variables.
In addition to exporting environnement variables using the shell, they can
also be set persistently in an `.env` file located  in the respective app / script
folder. In each folder, where this is relevant there is an `.env.example`
file that lists the variables that are recognized by the script.

`.env` files are ignored by git, so they suitable for setting secrets for
development purposes, such as private keys.

## Smart contracts

### Hardhat

The tasks of building, testing and migrating the contracts are managed by a [Hardhat](https://hardhat.org/) config file located here: [`libs/contracts/hardhat.config.ts`](libs/contracts/hardhat.config.ts)

Migration scripts (used for deploying the contracts) can be invoked from the [`libs/contracts`](./libs/contracts) folder like so:

```sh
yarn migrate-<migration script> --network <network name>
```

For example:

```sh
yarn migrate-finder --network kovan
```

### UML Class Diagram (Outdated - covers only v1)

[![mermaid diagram](https://mermaid.ink/img/eyJjb2RlIjoiY2xhc3NEaWFncmFtXG4gICAgVElDRmFjdG9yeSA8fC0tIE93bmFibGVcbiAgICBUSUNGYWN0b3J5IC0tPiBFeHBpcmluZ011bHRpUGFydHlDcmVhdG9yXG4gICAgVElDRmFjdG9yeSAtLT4gVElDXG4gICAgVElDSGVscGVyIC0tIFRJQ1xuICAgIFRJQ0ludGVyZmFjZSAtLXw-IFRJQ1xuICAgIFJlZW50cmFuY3lHdWFyZCAtLXw-IFRJQ1xuICAgIFRJQ0ZhY3RvcnkgPHwtLSBSZWVudHJhbmN5R3VhcmRcbiAgICBUSUMgLS0-IEV4cGlyaW5nTXVsdGlQYXJ0eVxuICAgIFRJQyAtLT4gUlRva2VuXG4gICAgRXhwaXJpbmdNdWx0aVBhcnR5Q3JlYXRvciAtLSogRXhwaXJpbmdNdWx0aVBhcnR5XG4gICAgRXhwaXJpbmdNdWx0aVBhcnR5IC0tPiBTeW50aGV0aWNUb2tlblxuICAgIERBSSA8LS0gVElDXG4gICAgUlRva2VuIC0tfD4gRVJDMjBcbiAgICBEQUkgLS18PiBFUkMyMFxuICAgIENUb2tlbiAtLXw-IEVSQzIwXG4gICAgU3ludGhldGljVG9rZW4gLS18PiBFUkMyMFxuICAgIFJUb2tlbiAtLT4gREFJXG4gICAgQ1Rva2VuIC0tPiBEQUlcbiAgICBSVG9rZW4gLS0-IENUb2tlblxuICAgIGNsYXNzIE93bmFibGV7XG4gICAgICAgICthZGRyZXNzIG93bmVyXG4gICAgICAgICtvbmx5T3duZXIoKVxuICAgIH1cbiAgICBjbGFzcyBSZWVudHJhbmN5R3VhcmQge1xuICAgICAgICArbm9uUmVlbnRyYW50KClcbiAgICB9XG4gICAgY2xhc3MgVElDe1xuICAgICAgICArRXhwaXJpbmdNdWx0aVBhcnR5IGRlcml2YXRpdmVcbiAgICAgICAgK0VSQzIwIGNvbGxhdGVyYWxUb2tlblxuICAgICAgICArRVJDMjAgc3ludGhldGljVG9rZW5cbiAgICAgICAgK2NvbnN0cnVjdG9yKF9kZXJpdmF0aXZlLCBfbGlxdWlkaXR5UHJvdmlkZXIsIF9zdGFydGluZ0NvbGxhdGVyYWxpemF0aW9uLCBfZmVlKVxuICAgICAgICArbWludChjb2xsYXRlcmFsQW1vdW50LCBudW1Ub2tlbnMpXG4gICAgICAgICtkZXBvc2l0KGNvbGxhdGVyYWxBbW91bnQpXG4gICAgICAgICt3aXRoZHJhd1JlcXVlc3QoY29sbGF0ZXJhbEFtb3VudClcbiAgICAgICAgK3dpdGhkcmF3UGFzc2VkUmVxdWVzdCgpXG4gICAgICAgICtzZXR0bGVFeHBpcmVkKClcbiAgICAgICAgK2V4Y2hhbmdlKGRlc3RUSUMsIG51bVRva2VucywgZGVzdE51bVRva2VucylcbiAgICAgICAgK2NhbGN1bGF0ZU1pbnRGZWUoY29sbGF0ZXJhbEFtb3VudClcbiAgICB9XG4gICAgY2xhc3MgVElDRmFjdG9yeXtcbiAgICAgICAgK0V4cGlyaW5nTXVsdGlQYXJ0eUNyZWF0b3IgZGVyaXZhdGl2ZUNyZWF0b3JcbiAgICAgICAgK2NvbnN0cnVjdG9yKF9kZXJpdmF0aXZlQ3JlYXRvcilcbiAgICAgICAgK2NyZWF0ZVRJQyhwYXJhbXMsIGxpcXVpZGl0eVByb3ZpZGVyLCBzdGFydGluZ0NvbGxhdGVyYWxpemF0aW9uLCBmZWVzKVxuICAgICAgICArc3ltYm9sVG9USUMoc3ltYm9sKVxuICAgIH1cbiAgICBjbGFzcyBFUkMyMHtcbiAgICAgICAgK3VpbnQyNTYgdG90YWxTdXBwbHlcbiAgICAgICAgK2JhbGFuY2VPZihhY2NvdW50KVxuICAgICAgICArdHJhbnNmZXIocmVjaXBpZW50LCBhbW91bnQpXG4gICAgICAgICthcHByb3ZlKHNwZW5kZXIsIGFtb3VudClcbiAgICAgICAgK3RyYW5zZmVyRnJvbShzZW5kZXIsIHJlY2lwaWVudCwgYW1vdW50KVxuICAgIH1cbiAgICBjbGFzcyBFeHBpcmluZ011bHRpUGFydHlDcmVhdG9ye1xuICAgICAgICArY3JlYXRlRXhwaXJpbmdNdWx0aVBhcnR5KHBhcmFtcylcbiAgICB9XG4gICAgY2xhc3MgUlRva2Vue1xuICAgICAgICArY3JlYXRlSGF0KHJlY2lwaWVudHMsIHByb3BvcnRpb25zLCBkb0NoYW5nZUhhdClcbiAgICAgICAgK21pbnRXaXRoU2VsZWN0ZWRIYXQobWludEFtb3VudCwgaGF0SUQpXG4gICAgICAgICtyZWRlZW1BbmRUcmFuc2ZlcihyZWRlZW1UbywgcmVkZWVtVG9rZW5zKVxuICAgIH1cbiAgICBjbGFzcyBFeHBpcmluZ011bHRpUGFydHl7XG4gICAgICAgICtFUkMyMCBjb2xsYXRlcmFsQ3VycmVuY3lcbiAgICAgICAgK0VSQzIwIHRva2VuQ3VycmVuY3lcbiAgICAgICAgK0ZpeGVkUG9pbnQgZXhwaXJ5UHJpY2VcbiAgICAgICAgK0ZpeGVkUG9pbnQgdG90YWxUb2tlbnNPdXRzdGFuZGluZ1xuICAgICAgICArRml4ZWRQb2ludCB0b3RhbFBvc2l0aW9uQ29sbGF0ZXJhbFxuICAgICAgICArY3JlYXRlKGNvbGxhdGVyYWxBbW91bnQsIG51bVRva2VucylcbiAgICAgICAgK3JlcXVlc3RXaXRoZHJhd2FsKGNvbGxhdGVyYWxBbW91bnQpXG4gICAgICAgICt3aXRoZHJhd1Bhc3NlZFJlcXVlc3QoKVxuICAgICAgICArZXhwaXJlKClcbiAgICAgICAgK3NldHRsZUV4cGlyZWQoKVxuICAgICAgICArcmVkZWVtKG51bVRva2VucylcbiAgICB9XG4gICAgY2xhc3MgQ1Rva2Vue1xuICAgICAgICArYWNjcnVlSW50ZXJlc3QoKVxuICAgIH0iLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9LCJ1cGRhdGVFZGl0b3IiOmZhbHNlfQ)](https://mermaid-js.github.io/mermaid-live-editor/#/edit/eyJjb2RlIjoiY2xhc3NEaWFncmFtXG4gICAgVElDRmFjdG9yeSA8fC0tIE93bmFibGVcbiAgICBUSUNGYWN0b3J5IC0tPiBFeHBpcmluZ011bHRpUGFydHlDcmVhdG9yXG4gICAgVElDRmFjdG9yeSAtLT4gVElDXG4gICAgVElDSGVscGVyIC0tIFRJQ1xuICAgIFRJQ0ludGVyZmFjZSAtLXw-IFRJQ1xuICAgIFJlZW50cmFuY3lHdWFyZCAtLXw-IFRJQ1xuICAgIFRJQ0ZhY3RvcnkgPHwtLSBSZWVudHJhbmN5R3VhcmRcbiAgICBUSUMgLS0-IEV4cGlyaW5nTXVsdGlQYXJ0eVxuICAgIFRJQyAtLT4gUlRva2VuXG4gICAgRXhwaXJpbmdNdWx0aVBhcnR5Q3JlYXRvciAtLSogRXhwaXJpbmdNdWx0aVBhcnR5XG4gICAgRXhwaXJpbmdNdWx0aVBhcnR5IC0tPiBTeW50aGV0aWNUb2tlblxuICAgIERBSSA8LS0gVElDXG4gICAgUlRva2VuIC0tfD4gRVJDMjBcbiAgICBEQUkgLS18PiBFUkMyMFxuICAgIENUb2tlbiAtLXw-IEVSQzIwXG4gICAgU3ludGhldGljVG9rZW4gLS18PiBFUkMyMFxuICAgIFJUb2tlbiAtLT4gREFJXG4gICAgQ1Rva2VuIC0tPiBEQUlcbiAgICBSVG9rZW4gLS0-IENUb2tlblxuICAgIGNsYXNzIE93bmFibGV7XG4gICAgICAgICthZGRyZXNzIG93bmVyXG4gICAgICAgICtvbmx5T3duZXIoKVxuICAgIH1cbiAgICBjbGFzcyBSZWVudHJhbmN5R3VhcmQge1xuICAgICAgICArbm9uUmVlbnRyYW50KClcbiAgICB9XG4gICAgY2xhc3MgVElDe1xuICAgICAgICArRXhwaXJpbmdNdWx0aVBhcnR5IGRlcml2YXRpdmVcbiAgICAgICAgK0VSQzIwIGNvbGxhdGVyYWxUb2tlblxuICAgICAgICArRVJDMjAgc3ludGhldGljVG9rZW5cbiAgICAgICAgK2NvbnN0cnVjdG9yKF9kZXJpdmF0aXZlLCBfbGlxdWlkaXR5UHJvdmlkZXIsIF9zdGFydGluZ0NvbGxhdGVyYWxpemF0aW9uLCBfZmVlKVxuICAgICAgICArbWludChjb2xsYXRlcmFsQW1vdW50LCBudW1Ub2tlbnMpXG4gICAgICAgICtkZXBvc2l0KGNvbGxhdGVyYWxBbW91bnQpXG4gICAgICAgICt3aXRoZHJhd1JlcXVlc3QoY29sbGF0ZXJhbEFtb3VudClcbiAgICAgICAgK3dpdGhkcmF3UGFzc2VkUmVxdWVzdCgpXG4gICAgICAgICtzZXR0bGVFeHBpcmVkKClcbiAgICAgICAgK2V4Y2hhbmdlKGRlc3RUSUMsIG51bVRva2VucywgZGVzdE51bVRva2VucylcbiAgICAgICAgK2NhbGN1bGF0ZU1pbnRGZWUoY29sbGF0ZXJhbEFtb3VudClcbiAgICB9XG4gICAgY2xhc3MgVElDRmFjdG9yeXtcbiAgICAgICAgK0V4cGlyaW5nTXVsdGlQYXJ0eUNyZWF0b3IgZGVyaXZhdGl2ZUNyZWF0b3JcbiAgICAgICAgK2NvbnN0cnVjdG9yKF9kZXJpdmF0aXZlQ3JlYXRvcilcbiAgICAgICAgK2NyZWF0ZVRJQyhwYXJhbXMsIGxpcXVpZGl0eVByb3ZpZGVyLCBzdGFydGluZ0NvbGxhdGVyYWxpemF0aW9uLCBmZWVzKVxuICAgICAgICArc3ltYm9sVG9USUMoc3ltYm9sKVxuICAgIH1cbiAgICBjbGFzcyBFUkMyMHtcbiAgICAgICAgK3VpbnQyNTYgdG90YWxTdXBwbHlcbiAgICAgICAgK2JhbGFuY2VPZihhY2NvdW50KVxuICAgICAgICArdHJhbnNmZXIocmVjaXBpZW50LCBhbW91bnQpXG4gICAgICAgICthcHByb3ZlKHNwZW5kZXIsIGFtb3VudClcbiAgICAgICAgK3RyYW5zZmVyRnJvbShzZW5kZXIsIHJlY2lwaWVudCwgYW1vdW50KVxuICAgIH1cbiAgICBjbGFzcyBFeHBpcmluZ011bHRpUGFydHlDcmVhdG9ye1xuICAgICAgICArY3JlYXRlRXhwaXJpbmdNdWx0aVBhcnR5KHBhcmFtcylcbiAgICB9XG4gICAgY2xhc3MgUlRva2Vue1xuICAgICAgICArY3JlYXRlSGF0KHJlY2lwaWVudHMsIHByb3BvcnRpb25zLCBkb0NoYW5nZUhhdClcbiAgICAgICAgK21pbnRXaXRoU2VsZWN0ZWRIYXQobWludEFtb3VudCwgaGF0SUQpXG4gICAgICAgICtyZWRlZW1BbmRUcmFuc2ZlcihyZWRlZW1UbywgcmVkZWVtVG9rZW5zKVxuICAgIH1cbiAgICBjbGFzcyBFeHBpcmluZ011bHRpUGFydHl7XG4gICAgICAgICtFUkMyMCBjb2xsYXRlcmFsQ3VycmVuY3lcbiAgICAgICAgK0VSQzIwIHRva2VuQ3VycmVuY3lcbiAgICAgICAgK0ZpeGVkUG9pbnQgZXhwaXJ5UHJpY2VcbiAgICAgICAgK0ZpeGVkUG9pbnQgdG90YWxUb2tlbnNPdXRzdGFuZGluZ1xuICAgICAgICArRml4ZWRQb2ludCB0b3RhbFBvc2l0aW9uQ29sbGF0ZXJhbFxuICAgICAgICArY3JlYXRlKGNvbGxhdGVyYWxBbW91bnQsIG51bVRva2VucylcbiAgICAgICAgK3JlcXVlc3RXaXRoZHJhd2FsKGNvbGxhdGVyYWxBbW91bnQpXG4gICAgICAgICt3aXRoZHJhd1Bhc3NlZFJlcXVlc3QoKVxuICAgICAgICArZXhwaXJlKClcbiAgICAgICAgK3NldHRsZUV4cGlyZWQoKVxuICAgICAgICArcmVkZWVtKG51bVRva2VucylcbiAgICB9XG4gICAgY2xhc3MgQ1Rva2Vue1xuICAgICAgICArYWNjcnVlSW50ZXJlc3QoKVxuICAgIH0iLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9LCJ1cGRhdGVFZGl0b3IiOmZhbHNlfQ)

### Installing new smart contract dependencies

Use NPM to install new dependencies in the root project directory. Smart contracts can import these dependencies and the compiler will resolve the correct path.

E.g. `import "@openzeppelin/contracts/math/SafeMath.sol";`

### Smart contract commands

SynFiat uses Truffle and therefore all the standard Truffle commands are available:

* `truffle console`
* `truffle compile`
* `truffle migrate`
* `truffle test`

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

**Tests must be run on a fork of the Kovan network.**

* Forking Kovan is necessary because the tests depend on deployed contracts for DAI, rDAI, and the ExpiringMultiPartyCreator. The rDAI address must also be on the ExpiringMultiPartyCreator whitelist.
* Creating a fork of the Kovan network with Ganache is easy. For example, if using Infura as the Ethereum client, run `ganache-cli -f https://kovan.infura.io/v3/{Infura ID}`.
* To use the included Ganache script `./run-ganache.sh`, set the following environment variables:
  * `ETH_WALLET_MNEMONIC` The 12 word seed phrase for the accounts used to test and deploy the SynFiat smart contracts.
  * `ETH_KOVAN_ENDPOINT` The endpoint for the Ethereum client connected to Kovan. E.g. `https://kovan.infura.io/v3/${INFURA_ID}`

**Truffle must be configured to create at least 2 accounts for the network used to run the tests.**

* For example, if using the HDWallet provider, the 4th argument specifying the number of accounts to make must be set to 2: `HDWalletProvider(mnemonic, kovanEndpoint, 0, 2)`.

**The 2 accounts used to run tests must be funded with ETH and DAI before the network is forked.**

* To obtain Kovan ETH (KETH) use the [Kovan faucet](https://faucet.kovan.network).
* To obtain DAI, either purchase some with KETH on [Oasis](https://oasis.app/trade/market/WETH/DAI) (make sure you set MetaMask to the Kovan network) or follow [these instructions](https://github.com/makerdao/developerguides/blob/master/mcd/mcd-cli/mcd-cli-guide-01/mcd-cli-guide-01.md) to set up a CDP and mint DAI.
* Remember, it is important that the DAI contract is the same one that is used by the whitelisted rDAI contract.
* You can find a list of all the Kovan DAI contract addresses that will work with the whitelisted rDAI contract [here](https://changelog.makerdao.com/releases/kovan/1.0.1/contracts.json).

### Running the TIC tests

To run the TIC tests, simply use the following Truffle command:

```sh
truffle --network kovan-fork test
```

## Deployment

### Deployment requirements

The SynFiat migration scripts in `./migrations` will only deploy properly when used with either the Kovan network or a fork of Kovan.

### Running migrations

To deploy the SynFiat smart contracts with the migration scripts, run the following Truffle command:

```sh
truffle --network kovan migrate
```

If the contracts have already been deployed but changes have been made and they must be deployed again, use the `--reset` flag.

### Changing derivative parameters

Derivative parameters can be changed in `./tic-config.json`. The following parameters are used:

* `expirationTimestamp`: Time that the derivative expires.
* `disputeBondPct`: Percent of a liquidation position's locked collateral to be deposited by a potential disputer.
* `sponsorDisputeRewardPct`: Percent of price paid to sponsor in the Disputed state (i.e. following a successful dispute).
* `disputerDisputeRewardPct`: Percent of price paid to disputer in the Disputed state (i.e. following a successful dispute).

E.g.

```json
{
  "expirationTimestamp": 1590969600,
  "disputeBondPct": { "rawValue": "1500000000000000000" },
  "sponsorDisputeRewardPct": { "rawValue": "500000000000000000" },
  "disputerDisputeRewardPct": { "rawValue": "400000000000000000" }
}
```

### Creating new SynFiat assets

New synthetic assets can be created by modifying `./synthetic-assets.json` before running the migration scripts.

Simply add a new object to the JSON array in `./synthetic-assets.json`. The following parameters are used:

* `syntheticName`: The name which describes the new token.
* `syntheticSymbol`: The ticker abbreviation of the name.
* `priceFeedIdentifier`: Unique identifier for DVM price feed ticker.
* `collateralRequirement`: The collateral ratio required to prevent liquidation
* `startingCollateralization`: The collateral to token ratio used when the global ratio is zero

E.g.

```json
[
  ...
  {
    "syntheticName": "Jarvis Synthetic Euro",
    "syntheticSymbol": "jEUR",
    "priceFeedIdentifier": "EUR/USD",
    "collateralRequirement": { "rawValue": "1100000000000000000" },
    "startingCollateralization": "1300000000000000000"
  }
]
```

Now when running `truffle --network kovan migrate --reset`, this new synthetic asset will also be deployed.

## Using the TIC (Token Issuer Contract)

First import the `TICFactory` Truffle artifact stored in `./client/src/contracts` and create the contract instance with web3.

```js
import TICFactory from "./contracts/TICFactory.json";

const networkId = await web3.eth.net.getId();
const factory = new web3.eth.Contract(TICFactory.abi, TICFactory.networks[networkId].address);
```

The factory is then used to retrieve the TIC for the synthetic asset you wish to interact with.

```js
import TIC from "./contracts/TIC.json";

// ...
const ticAddress = await factory.methods.symbolToTIC("jEUR").call();
const tic = new web3.eth.Contract(TIC.abi, ticAddress);
```

Create the DAI contract instance. This is needed to approve the DAI transfers that will be made by the TIC.

```js
import IERC20 from "./contracts/IERC20.json";

// ...
const daiAddress = await tic.collateralToken();
const dai = new web3.eth.Contract(IERC20.abi, daiAddress);
```

Create the synthetic token contract instance. This is the token minted by the TIC for the user.

```js
const syntheticTokenAddress = await tic.methods.syntheticToken().call();
const syntheticToken = new web3.eth.Contract(IERC20.abi, syntheticTokenAddress);
```

Finally get the account addresses we will use to interact with the contracts.

```js
const accounts = await web3.eth.getAccounts();
```

### Making a collateral deposit as a liquidity provider

We will assume that `accounts[0]` is the liquidity provider.

Set the amount of collateral to deposit.

```js
const collateralAmount = web3.utils.toWei("10");
```

Approve the transfer of DAI collateral.

```js
await dai.methods.approve(tic.address, collateralAmount).send({ from: accounts[0] });
```

Deposit the DAI collateral.

```js
await tic.methods.deposit(collateralAmount).send({ from: accounts[0] });
```

### Minting jEUR as a user

We will assume that `accounts[1]` is the user.

Set the amount of collateral used to mint tokens.

```js
const collateralAmount = web3.utils.toWei("10");
```

Set the number of tokens we will try to mint with the collateral.

```js
const numTokens = web3.utils.toWei("100");
```

Calculate the fees for the user.

```js
const fees = await tic.methods.calculateMintFee(collateralAmount).call();
```

Calculate the total amount of DAI the user will need to transfer (collateral plus fees).

```js
const totalToTransfer = web3.utils.toBN(collateralAmount).add(web3.utils.toBN(fees));
```

Approve the transfer of DAI.

```js
await dai.methods.approve(tic.address, totalToTransfer).send({ from: accounts[1] });
```

Mint the jEUR tokens.

```js
await tic.methods.mint(collateralAmount, numTokens).send({ from: accounts[1] });
```

### Viewing jEUR balance

View the jEUR balance.

```js
const jeurBalance = await syntheticToken.methods.balanceOf(accounts[1]).call();
console.log(web3.utils.fromWei(jeurBalance.toString()));
```

### Transfering jEUR

Set the amount of jEUR tokens to transfer. In this case we will transfer all the tokens owned by a user.

```js
const jeurToTransfer = await syntheticToken.methods.balanceOf(accounts[1]).call();
```

Transfer the jEUR tokens to `accounts[2]`.

```js
await derivative.methods.transfer(accounts[2], jeurToTransfer).send({ from: accounts[1] });
```

### Redeeming jEUR at contract expiry as a user

Set the amount of jEUR tokens to redeem. In this case we will redeem all the
tokens owned by a user.

```js
const jeurToTransfer = await syntheticToken.methods.balanceOf(accounts[1]).call();
```

Approve the transfer of jEUR tokens.

```js
await syntheticToken.methods.approve(tic.options.address, jeurBalance).send({ from: accounts[1] });
```

Redeem the user's jEUR tokens.

```js
await tic.methods.settleExpired().send({ from: accounts[1] });
```

### Withdrawing collateral as a liquidity provider

We will assume that `accounts[0]` is the liquidity provider.

Set the amount of collateral to withdraw. Note that if a LP tries to withdraw enough collateral to undercollateralize the contract, they will be at risk of liquidation.

```js
const excessCollateral = web3.utils.toWei("5");
```

Submit a withdraw request.

```js
await tic.methods.withdrawRequest(excessCollateral).send({ from: accounts[0] });
```

If the request is not disputed during the withdrawal liveness period, the request can be fulfilled.

```js
await tic.methods.withdrawPassedRequest({ from: accounts[0] });
```

Withdraw the collateral to the liquidity provider's account.

```js
await tic.methods.withdraw(excessCollateral).send({ from: accounts[0] });
```

### Atomic swap between tokens as a user

Set the amount of source tokens to swap.

```js
const numTokens = web3.utils.toWei("10");
```

Set the amount of destination tokens to receive.

```js
const destNumTokens = web3.utils.toWei("10");
```

Get the destination TIC you wish to swap tokens with.

```js
const otherTICAddress = await factory.methods.symbolToTIC("jGBP");
const otherTIC = new web3.eth.Contract(TIC.abi, otherTICAddress);
```

Approve the transfer of the source tokens.

```js
await syntheticToken.methods.approve(tic.address, numTokens).send({ from: accounts[1] });
```

Perform the atomic swap of tokens.

```js
await tic.exchange(otherTIC.address, numTokens, destNumTokens);
```
