import { styled } from '@jarvis-network/ui';

export const Background = styled.div<{ image: string }>`
  height: 100%;
  background-repeat: no-repeat;
  background-color: ${props => props.theme.background.secondary};
  background-size: cover;
  background-image: url(${props => props.image});

  @media (min-width: 721px) {
    background-position: center 118px;
  }
`;
