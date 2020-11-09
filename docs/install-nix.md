# Nix setup for Jarvis Exchange

<!-- markdownlint-disable no-inline-html -->

## Installing Nix with flake support and configuring direnv

For the most up-to-date advice on installing Nix, please consult the official manual:
<https://nixos.org/manual/nix/stable/#chap-installation>.

Here we will consolidate our advice on setting up Nix on your system.

### 1. Install Nix and integrate it with your shell (skip if you're already using NixOS)

#### 1.1. Install Nix

<details>
<summary>Linux (non-NixOS)</summary>

Nix supports both single-user (`--no-daemon`) and multi-user (`--daemon`) installation.
We recommend using the single-user installation mode, for simplicity:

```sh
curl -fsSLo ./install-nix-2.3.8 https://releases.nixos.org/nix/nix-2.3.8/install \
    && echo "e6b808ea2b2619d38a66d40b66b69709e85344167c403575811d4802f3d55446 install-nix-2.3.8" | sha256sum -c \
    && sh ./install-nix-2.3.8 --no-daemon \
    && rm -v ./install-nix-2.3.8
```

Run the command above and it will:

1. Download the Nix install script to `./install-nix-2.3.8`
2. Verify that its SHA-256 matches the expected value
3. Start the installation in single-user mode

During the process you will be asked for `sudo` access once (needed for creating the `/nix` store), after which the script will take care of the rest.

</details>

<details>
<summary>macOS</summary>

**IMPORTANT:** The following is only verified on macOS versions prior to Big
Sur. If you want to use the Nix package manger, we recommend holding off on
the update, until Nix [support for Big Sur is
complete](https://github.com/NixOS/nixpkgs/projects/2#column-10868240).

```sh
curl -fsSLo install-nix-2.3.8 https://releases.nixos.org/nix/nix-2.3.8/install \
    && echo "e6b808ea2b2619d38a66d40b66b69709e85344167c403575811d4802f3d55446 install-nix-2.3.8" | shasum -a 256 -c \
    && sh ./install-nix-2.3.8 --darwin-use-unencrypted-nix-store-volume \
    && rm -v ./install-nix-2.3.8
```

</details>

<details>
<summary>Windows</summary>

1. Install [WSL][1] ([WSL 2.0][2] is strongly recommended)
2. Proceed to install Nix on Linux, as detailed above

</details>

#### 1.2. Ensure that `nix-env` is in your `$PATH` (for non-NixOS users)

The Nix single-user installation (detailed above) will create the following
script: `$HOME/.nix-profile/etc/profile.d/nix.sh` which, if you're using a
Bash-compatible shell and you're on Linux, should be `source`-d automatically
on your next shell login.

If you're using macOS, you need to source this file manually in your shell
profile (e.g. `$HOME/.bashrc` / `$HOME/.zshrc`), so it can be loaded
automatically on shell start up.

If you're using [Fish](https://fishshell.com/) shell, you can do the following:

1. Install [`fenv`](https://github.com/oh-my-fish/plugin-foreign-env)
2. Create a script to source the nix profile through `fenv` on startup:

    ```sh
    echo 'fenv source "$HOME/.nix-profile/etc/profile.d/nix.sh"' > $HOME/.config/fish/conf.d/nix.fish
    ```

---

To verify that your Nix installation is functional, you need to logout and login to your shell and install and run a program (e.g. [GNU Hello][4]) like this:

```sh
nix-env -iA nixpkgs.hello
hello
```

### 2. Enable the experimental Nix features `nix-command` and `flakes`

<details>
<summary>NixOS</summary>

Create/update the `nix` attribute in your `configuration.nix` file (usually located under
`/etc/nixos/configuration.nix`) as follows:

```nix
{ pkgs, ... }: {
  # ...
  nix = {
    package = pkgs.nixFlakes;
    extraOptions = ''
      experimental-features = nix-command flakes
    '';
  };
  # ...
}
```

And rebuild your system:

```sh
sudo nixos-rebuild switch
```

</details>

<details>
<summary>Non-NixOS</summary>

1. Install [`nixFlakes`][3] (aka `nixUnstable`) in your environment (user profile):

    ```sh
    nix-env -iA nixpkgs.nixFlakes
    ```

2. Edit (or create if it doesn't exist) either `~/.config/nix/nix.conf` or `/etc/nix/nix.conf` and add:

    ```conf
    experimental-features = nix-command flakes
    ```

</details>

### 3. Setup [`direnv`](https://direnv.net/)

1. Install `direnv`:

    * Imperatively:

        ```sh
        nix-env -iA nixpkgs.direnv
        ```

    * ...or declaratively by adding it to your `configuration.nix` / `home.nix`
      files.

2. Integrate `direnv` with your shell, as described in the official docs:
<https://direnv.net/docs/hook.html>

3. Allow `direnv` to interpret the `.envrc` file in the project root folder

    ```sh
    direnv allow .
    ```

    <details>
    <summary>Sample output</summary>

    ```txt
    direnv: loading ~/code/repos/jarvis-network/apps/exchange/mono-repo/.envrc
    direnv: using flake
    warning: Git tree '/home/zlx/code/repos/jarvis-network/apps/exchange/mono-repo' is dirty
    direnv: export +AR +AS +CC +CONFIG_SHELL +CXX +DETERMINISTIC_BUILD +HOST_PATH +IN_NIX_SHELL +LD +NIX_BINTOOLS +NIX_BINTOOLS_WRAPPER_TARGET_HOST_x86_64_unknown_linux_gnu +NIX_BUILD_CORES +NIX_BUILD_TOP +NIX_CC +NIX_CC_WRAPPER_TARGET_HOST_x86_64_unknown_linux_gnu +NIX_CFLAGS_COMPILE +NIX_ENFORCE_NO_NATIVE +NIX_HARDENING_ENABLE +NIX_INDENT_MAKE +NIX_LDFLAGS +NIX_STORE +NM +NODE_PATH +OBJCOPY +OBJDUMP +PYTHONHASHSEED +PYTHONNOUSERSITE +PYTHONPATH +RANLIB +READELF +SIZE +SOURCE_DATE_EPOCH +STRINGS +STRIP +TEMP +TEMPDIR +TMP +TMPDIR +buildInputs +builder +configureFlags +depsBuildBuild +depsBuildBuildPropagated +depsBuildTarget +depsBuildTargetPropagated +depsHostHost +depsHostHostPropagated +depsTargetTarget +depsTargetTargetPropagated +doCheck +doInstallCheck +dontAddDisableDepTrack +name +nativeBuildInputs +nobuildPhase +out +outputs +patches +phases +propagatedBuildInputs +propagatedNativeBuildInputs +shell +shellHook +stdenv +strictDeps +system ~PATH
    ```

    </details>

4. You can verify that the setup is working by running:

    ```sh
    direnv status
    ```

    <details>
    <summary>Sample output</summary>

    ```txt
    direnv exec path /nix/store/086y8hv6ayv0y90690xbff0lxgrpi6k8-direnv-2.21.2-bin/bin/direnv
    DIRENV_CONFIG /home/$USER/.config/direnv
    bash_path /nix/store/2jysm3dfsgby5sw5jgj43qjrb5v79ms9-bash-4.4-p23/bin/bash
    disable_stdin false
    warn_timeout 5s
    whitelist.prefix []
    whitelist.exact map[]
    Loaded RC path /home/$USER/code/repos/jarvis-network/apps/exchange/mono-repo/.envrc
    Loaded watch: ".envrc" - 2020-11-09T17:05:20+02:00
    Loaded watch: "../../../../../../.local/share/direnv/allow/3fc4de19f6f6478d9eddb3f0f18a27d109f8a90f0acecffe4225c7da48de97c1" - 2020-11-09T19:16:30+02:00
    Loaded watch: "flake.nix" - 2020-11-09T17:14:14+02:00
    Loaded watch: "flake.lock" - 2020-11-09T18:20:52+02:00
    Loaded RC allowed false
    Loaded RC allowPath
    Found RC path /home/$USER/code/repos/jarvis-network/apps/exchange/mono-repo/.envrc
    Found watch: ".envrc" - 2020-11-09T17:05:20+02:00
    Found watch: "../../../../../../.local/share/direnv/allow/3fc4de19f6f6478d9eddb3f0f18a27d109f8a90f0acecffe4225c7da48de97c1" - 2020-11-09T19:16:30+02:00
    Found RC allowed true
    Found RC allowPath /home/$USER/.local/share/direnv/allow/3fc4de19f6f6478d9eddb3f0f18a27d109f8a90f0acecffe4225c7da48de97c1
    ```

    </details>

[1]: https://docs.microsoft.com/en-us/windows/wsl/
[2]: https://docs.microsoft.com/en-us/windows/wsl/compare-versions#whats-new-in-wsl-2
[3]: https://search.nixos.org/packages?channel=20.09&show=nixFlakes&from=0&size=30&sort=relevance&query=nixFlakes
[4]: https://www.gnu.org/software/hello/
