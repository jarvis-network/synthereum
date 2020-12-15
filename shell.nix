{ pkgs ? import <nixpkgs> { } }: with pkgs;
let
  yarn = pkgs.callPackage ./nix/pkgs/yarn/default.nix { inherit stdenv; };
in
mkShell {
  buildInputs = [
    fish
    git
    docker
    docker-compose
    nodejs-14_x
    (yarn.override { nodejs = nodejs-14_x; })
    nodePackages.lerna
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
