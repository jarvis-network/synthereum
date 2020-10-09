import React from "react";

import Link from "next/link";
import { useDispatch } from 'react-redux'

import { Icon, styled, Header, AccountButton } from "@jarvis-network/ui";
import { setTheme } from "state/slices/theme";

const OwnLink = ({ to, ...props}) => <Link {...props} href={to} />
const logo = "https://d33wubrfki0l68.cloudfront.net/cf92ecc3b3c83e822a26da3d0ae3dc4af972cde4/86de9/assets/images/jarvis.svg";

const ls = {
  render() {
    return (
      <>
        <Icon icon={"BsCheck"} /> This project supports UI library.
        <AccountButton name="johndoe" wallet="0x235c..fe47" />
      </>
    )
  }
}

const Wrapper = styled.div`
background: ${props => props.theme.background.primary};
color: ${props => props.theme.text.primary};
`;

export default function Home() {
  const dispatch = useDispatch();

  const handleSetTheme = (theme) => {
    dispatch(setTheme({ theme }))
  }

  return (
    <Wrapper>
      <Header
        leftSide={ls}
        rightSide={{ actionButtons: [] }}
        link={OwnLink}
        logoUrl={logo}
      />

      <Link href={"/exchange"}>Exchange page</Link>

      <br />

      <button onClick={handleSetTheme.bind(null, "dark")}>Set dark mode</button>
      <button onClick={handleSetTheme.bind(null, "night")}>Set night mode</button>
      <button onClick={handleSetTheme.bind(null, "light")}>Set light mode</button>
    </Wrapper>
  )
}
