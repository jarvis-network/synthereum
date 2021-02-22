import React from 'react';
import { Icon, styled, themeValue } from '@jarvis-network/ui';

export const ImgContainer = styled.div`
  flex: 1;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    justify-content: center;
    align-items: center;
  }
`;

export const Img = styled.img`
  display: block;
  margin: auto;
  height: 112px;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    height: 80%;
    width: 80%;
    object-fit: contain;
  }
`;

export const P = styled.p`
  font-size: ${props => props.theme.font.sizes.s};
`;
export const BigP = styled.p``;

export const TutorialContent = styled.div`
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

export const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export const IconButton = styled.button`
  border: none;
  background: none;
  padding: 10px;
  cursor: pointer;
  outline: none !important;

  i svg {
    right: -10px;
    width: 24px;
    height: 24px;
    position: relative;
    top: 3px;
    fill: ${props => props.theme.text.primary};
  }
`;

const RotatedIcon = styled(Icon)`
  transform: rotate(-90deg);
`;

export const ChevronRight = () => <RotatedIcon icon="BsChevronDown" />;
