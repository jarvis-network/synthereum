import React from "react";
import { useSelector } from 'react-redux'

import {State} from "state/initialState";
import StickyHeader from "components/header/StickyHeader";
import backgroundMap from "data/backgrounds";
import Background from "components/Background";
import ExampleBox from "components/ExampleBox";

export default function Home() {
  const theme = useSelector((state: State) => state.theme);
  const url = backgroundMap[theme];

  return (
    <StickyHeader>
      <Background image={url}>
        <ExampleBox />
      </Background>
    </StickyHeader>
  )
}
