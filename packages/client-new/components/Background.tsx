import {styled} from "@jarvis-network/ui";

const Background = styled.div<{ image: string }>`
  @keyframes animatedBackground {
      0% { background-position: center 0; }
      100% { background-position: center 118px; }
  }

  height: 100%;
  background-repeat: no-repeat;
  background-color: ${props => props.theme.background.secondary};
  background-size: cover;
  background-image: url(${props => props.image});

  @media (min-width: 721px) {
    background-position: center 118px;
    animation: animatedBackground 500ms cubic-bezier(0.430, -0.045, 0.665, 1.640) 1;
  }
`

export default Background;
