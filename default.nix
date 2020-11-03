with (import <nixpkgs> {});
mkShell {
  buildInputs = [
    python3
    nodejs
    yarn
    docker
    docker-compose
  ];
}
