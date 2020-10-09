import React from "react";
import {styled} from "@jarvis-network/ui";

interface Props {
  onClick: () => void;
}

const Button = styled.button`
  display: block;
  padding: 5px 15px;
  border: 1px solid ${props => props.theme.border.primary};
  background: ${props => props.theme.background.primary};
  color: ${props => props.theme.text.primary};
  font-weight: 700;
  text-align: left;
  font-size: 23px;
  height: 50px;
  width: 320px;
  font-family: inherit;
  cursor: pointer;
  outline: none;
`

const SignInUpButton: React.FC<Props> = (props) => {
    return (
      <Button onClick={props.onClick}>Sign in / Sign up</Button>
    );
};

export default SignInUpButton;
