import React, {useEffect, useState} from "react";
import { useSelector } from 'react-redux'
import {State} from "../state/initialState";
import backgroundMap from "../data/backgrounds";

const PreloadBackground = (props) => {
  const [isLoaded, setLoaded] = useState(false)

  const theme = useSelector((state: State) => state.theme);
  const url = backgroundMap[theme];

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setLoaded(true)
    }

    img.src = url;
  }, [])

  if (isLoaded) {
    return props.children;
  }

  return null; // @todo some kind of full screen preloader?
};

export default PreloadBackground;
