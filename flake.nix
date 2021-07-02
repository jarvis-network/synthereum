{
  description = "Nix Flake for Jarvis Exchange";

  inputs = {
    nixpkgs.url = github:NixOS/nixpkgs/nixos-21.05;
    flake-utils.url = github:numtide/flake-utils;
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem
      (system:
        let pkgs = nixpkgs.legacyPackages.${system}; in
        {
          devShell = import ./shell.nix { inherit pkgs; };

          # Packages can be ignored for now as currently we use this nix flake
          # mainly for `nix develop`:
          packages.hello = pkgs.hello;
          defaultPackage = self.packages.${system}.hello;
        }
      );
}
