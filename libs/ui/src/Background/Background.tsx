import { styled } from "../Theme";

export const Background = styled.div<{ image: string }>`
  height: 100%;
  background-repeat: no-repeat;
  background-color: ${props => props.theme.background.medium};
  background-size: cover;
  background-image: url(${props => props.image});

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex] + 1}px) {
    background-position: center 118px;
  }
`;
