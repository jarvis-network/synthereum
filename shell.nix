{ pkgs ? import <nixpkgs> { } }: with pkgs;
mkShell {
  buildInputs = [
    nodejs-14_x
    (yarn.override { nodejs = nodejs-14_x; })
    python3
    docker
    docker-compose
  ];
}
