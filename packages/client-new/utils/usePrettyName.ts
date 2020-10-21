import {useContext, useEffect, useState} from "react";
import {ENSContext} from "components/auth/AuthProvider";

const noop = () => undefined;

const usePrettyName = (address: string) => {
  const [name, setName] = useState<string>(null);
  const ens = useContext(ENSContext)

  useEffect(() => {
    if (!ens) {
      return;
    }

    setName(null);
    ens.prettyName(address).then((name) => {
      setName(name)
    }).catch(noop)
  }, [ens, address])

  return name
};

export default usePrettyName;
