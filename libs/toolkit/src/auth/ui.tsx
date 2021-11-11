import { styled } from '@jarvis-network/ui';

export const LeftBorder = styled.div`
  background: ${props => props.theme.scroll.background};
  color: ${props => props.theme.text.primary};
  border-left: 9px solid ${props => props.theme.border.panel};
  border-radius: 10px;
  padding: 25px;
  height: 410px;
  width: 476px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    min-height: 85vh;
    min-width: 80vw;
    max-width: calc(100% - 60px);
    width: auto;
    margin: auto;
    overflow: auto;
  }
`;
