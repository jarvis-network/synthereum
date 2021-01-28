import React from 'react';
import { Icon, styled } from '@jarvis-network/ui';

export const ImgContainer = styled.div`
  flex: 1;
`;

export const Img = styled.img`
  display: block;
  margin: auto;
  height: 112px;
`;

export const P = styled.p`
  font-size: ${props => props.theme.font.sizes.s};
`;
export const BigP = styled.p``;

export const TutorialContent = styled.div`
  background: white;
  border-left: 9px solid ${props => props.theme.border.panel};
  border-radius: 10px;
  padding: 25px;
  height: 410px;
  width: 476px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
