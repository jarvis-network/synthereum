{ pkgs ? import <nixpkgs> { } }: with pkgs;
let
  node = nodejs-14_x;
in
mkShell {
  buildInputs = [
    ldc
    fish
    git
    (docker.override { buildxSupport = true; })
    docker-compose
    node
    (yarn.override { nodejs = node; })
    gnumake
    python3
    gccStdenv
    libusb1.dev
    pkg-config
    which
  ] ++ lib.optional (! stdenv.isDarwin) [ eudev ];

  shellHook = ''
    echo "Welcome to Jarvis"
    export NODE_PATH=$PWD/.nix-node
    export NPM_CONFIG_PREFIX=$PWD/.nix-node
    export PATH=$NODE_PATH/bin:$PATH
  '';
}
