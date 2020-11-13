{ stdenv, nodejs, fetchzip }:
let
  yarnVersion = "1.19.1";
  yarnSha256 = "52y3Bp7v5mfmtZa6FubMl0xYuUfifYy53y6CfXflmWI=";
in
stdenv.mkDerivation rec {
  pname = "yarn";
  version = yarnVersion;

  src = fetchzip {
    url = "https://github.com/yarnpkg/yarn/releases/download/v${version}/yarn-v${version}.tar.gz";
    sha256 = yarnSha256;
  };

  buildInputs = [ nodejs ];

  installPhase = ''
    mkdir -p $out/{bin,libexec/yarn/}
    cp -R . $out/libexec/yarn
    ln -s $out/libexec/yarn/bin/yarn.js $out/bin/yarn
    ln -s $out/libexec/yarn/bin/yarn.js $out/bin/yarnpkg
  '';

  meta = with stdenv.lib; {
    homepage = "https://yarnpkg.com/";
    description = "Fast, reliable, and secure dependency management for javascript";
    license = licenses.bsd2;
    maintainers = with maintainers; [ offline screendriver ];
    platforms = platforms.linux ++ platforms.darwin;
  };
}
