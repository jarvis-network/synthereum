set -e
option="${1}"
default_version='0.0.0-SNAPSHOT'
next_version="${2:-$default_version}"
case ${option} in
   --prepare)
      # Publish Docker in Github Packages
      echo $PWD
      cd ../..
      TAG="$next_version"
      docker pull jarvisnetworkcoreacr.azurecr.io/jarvis-network/apps/exchange/mono-repo/validator:latest
      docker tag jarvisnetworkcoreacr.azurecr.io/jarvis-network/apps/exchange/mono-repo/validator:latest jarvisnetworkcoreacr.azurecr.io/jarvis-network/apps/exchange/mono-repo/validator:"$next_version"
      docker push jarvisnetworkcoreacr.azurecr.io/jarvis-network/apps/exchange/mono-repo/validator:"$next_version"
      ;;
   *)
      ;;
esac
