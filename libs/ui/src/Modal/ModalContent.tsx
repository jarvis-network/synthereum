import React, { FC } from 'react';

import { styledScrollbars } from '../common/mixins';

import { IconButton } from '../IconButton';
import { styled } from '../Theme';

import { Modal } from './Modal';
import { ModalContentProps } from './types';

const Container = styled.div`
  background: ${props => props.theme.background.primary};
  color: ${props => props.theme.text.primary};
  box-shadow: ${props => props.theme.shadow.dark};
  padding: 24px;
  width: 100vw;
  height: 100vh;
  height: calc(100vh - calc(100vh - 100%));
  overflow-y: auto;
  border-radius: ${props => props.theme.borderRadius.s};

  ${props => styledScrollbars(props.theme.scroll.thumb, 'transparent')};

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1] + 1}px) {
    width: 432px;
    height: 362px;
  }
`;

const Heading = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
`;

const Title = styled.h3`
  font-size: ${props => props.theme.font.sizes.l};
  font-weight: 400 !important;
  margin: 0;
  padding: 0;
`;

const Content = styled.div`
  margin-top: 24px;
`;

export const ModalContent: FC<ModalContentProps> = ({
  isOpened,
  title,
  children,
  onClose,
}) => (
  <Modal isOpened={isOpened} onClose={onClose}>
    <Container className="modal-container">
      <Heading>
        <Title>{title}</Title>
        <IconButton
          onClick={onClose}
          icon="IoIosClose"
          type="transparent"
          size="xxxl"
          inline
        />
      </Heading>
      <Content>{children}</Content>
    </Container>
  </Modal>
);
