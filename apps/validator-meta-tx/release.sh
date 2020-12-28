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
      sed -i "/tag:/c\  tag: \"$(echo $TAG)\"" $PWD/helm/validator-meta-tx/values.yaml
      docker buildx bake release-validator-meta-tx --print
      docker pull jarvisnetworkcoreacr.azurecr.io/jarvis-network/apps/exchange/mono-repo/validator-meta-tx:latest
      docker tag jarvisnetworkcoreacr.azurecr.io/jarvis-network/apps/exchange/mono-repo/validator-meta-tx:latest jarvisnetworkcoreacr.azurecr.io/jarvis-network/apps/exchange/mono-repo/validator-meta-tx:"$next_version"
      docker push jarvisnetworkcoreacr.azurecr.io/jarvis-network/apps/exchange/mono-repo/validator-meta-tx:"$next_version"
      git add $PWD/helm/validator-meta-tx/values.yaml
      ;;
   *)
      ;;
esac
