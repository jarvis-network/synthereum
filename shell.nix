{ pkgs ? import <nixpkgs> { } }: with pkgs;
let
  node = nodejs-14_x;
in
mkShell {
  buildInputs = [
    node
    (yarn.override { nodejs = node; })
    which
    pkg-config
    git
    gccStdenv
    gnumake
    python3
    libusb1.dev
    ldc
    fish
    (docker.override { buildxSupport = true; })
    docker-compose
  ] ++ lib.optional (! stdenv.isDarwin) [ eudev ];

  shellHook = ''
    echo "Welcome to Jarvis"
    export NODE_PATH=$PWD/.nix-node
    export NPM_CONFIG_PREFIX=$PWD/.nix-node
    export PATH=$NODE_PATH/bin:$PATH
  '';
}
