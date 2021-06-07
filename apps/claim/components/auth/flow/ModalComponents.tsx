import React, { FC } from 'react';
import { Icon, styled, styledScrollbars } from '@jarvis-network/ui';

import { ModalHeaderProps } from './types';

export const ImgContainer = styled.div`
  flex: 1;
  justify-content: center;
  align-items: center;
  display: flex;
`;

export const Img = styled.img`
  display: block;
  margin: auto;
  height: 200px;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    height: 80%;
    width: 80%;
    object-fit: contain;
  }
`;

export const P = styled.p`
  font-size: ${props => props.theme.font.sizes.l};
  margin-left: -16px;
`;
export const BigP = styled.p`
  font-size: 20px;
  margin-bottom: 20px;
  margin-left: -16px;
`;

export const TutorialContent = styled.div`
  background: ${props => props.theme.scroll.background};
  color: ${props => props.theme.text.primary};
  border-left: 16px solid ${props => props.theme.border.panel};
  border-radius: 10px;
  padding: 40px;
  padding-top: 0;
  height: 500px;
  width: 600px;
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

const HeaderWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 20px 0;
`;

const HeaderTitle = styled.strong`
  font-size: ${props => props.theme.font.sizes.l};
`;

const HeaderIconButton = styled(IconButton)`
  padding: 0;
  margin-right: 10px;

  i svg {
    right: 0;
    top: 1px;
  }
`;

export const ModalHeader: FC<ModalHeaderProps> = ({ onBack, title }) => (
  <HeaderWrapper>
    <HeaderIconButton onClick={onBack}>
      <Icon icon="BsArrowLeft" />
    </HeaderIconButton>
    <HeaderTitle>{title}</HeaderTitle>
  </HeaderWrapper>
);

export const ContentWrapper = styled.div`
  width: 100%;
  max-height: 100%;
  padding: 15px;
  border: 1px solid ${props => props.theme.border.secondary};
  box-sizing: border-box;

  > h1,
  > h2 {
    text-align: center;
    paddin-top: 0;
    margin-top: 0;
  }

  > h1 {
    font-size: ${props => props.theme.font.sizes.l};
  }

  > h2 {
    font-size: ${props => props.theme.font.sizes.s};
  }

  ${props => styledScrollbars(props.theme)}
`;
