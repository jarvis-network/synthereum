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
    stdenv
    gnumake
    python3
    libusb1.dev
    ldc
    fish
    (docker.override { buildxSupport = true; })
    docker-compose
  ] ++ lib.optional (! stdenv.isDarwin) [
    eudev 
    libsecret
    glib
  ];

  shellHook = ''
    export NODE_PATH=$PWD/.nix-node
    export NPM_CONFIG_PREFIX=$PWD/.nix-node
    export PATH=$NODE_PATH/bin:$PATH
  '' + lib.optionalString (! stdenv.isDarwin) ''
    export LD_LIBRARY_PATH=${libsecret}/lib''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}
    export LD_LIBRARY_PATH=${stdenv.cc.cc.lib}/lib''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}
    export LD_LIBRARY_PATH=${glib.out}/lib''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}
    echo "''${bold}Installed libraries required for graph auth''${normal}"
  '' + ''
    echo "Welcome to Jarvis"
  '';
}
