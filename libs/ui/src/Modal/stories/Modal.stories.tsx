import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { boolean, number, select } from '@storybook/addon-knobs';

import { ModalProps } from '../types';

import { Form, FormGroup } from '../../Form';
import { Input } from '../../Input';
import { Label } from '../../Label';
import { Button } from '../../Button';
import { styled } from '../../Theme';

import { Modal } from '..';

export default {
  title: 'Modal/Modal',
  component: Modal,
};

type StatefulModalProps = Omit<ModalProps, 'onClose' | 'isOpened'> & {
  className?: string;
};

const StatefulModal: React.FC<StatefulModalProps> = ({
  children,
  ...props
}) => {
  const [isOpened, setOpened] = useState(false);
  const toggleOpened = () => setOpened(!isOpened);

  return (
    <>
      <Button onClick={toggleOpened}>Open modal</Button>
      <Modal isOpened={isOpened} onClose={toggleOpened} {...props}>
        {children}
      </Modal>
    </>
  );
};

const ModalContent = styled.div`
  background: white;
  color: black;
`;

const AlignedOverlayContent = styled.div`
  background: pink;

  h3 {
    text-decoration: underline;
  }
`;

const AlignmentComponentContent = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const CustomStatefulModal = styled(StatefulModal)`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
  width: 250px;
`;

const MainComponentWrapper = styled(motion.div)`
  background: #ccc;
  margin: 20px;
  padding: 20px;
  width: 250px;
`;

const OverlayContentWrapper = styled.div`
  margin: 20px 0;
`;

export const Default = () => (
  <StatefulModal>
    <ModalContent>
      <h3>Simple modal</h3>
    </ModalContent>
  </StatefulModal>
);

export const WithCustomOverlayClassName = () => (
  <StatefulModal overlayStyle={{ background: 'rgba(255, 192, 203, 0.5)' }}>
    <ModalContent>
      <h3>Custom Layout</h3>
    </ModalContent>
  </StatefulModal>
);

export const WithAnimation = () => (
  <StatefulModal animation="slideTop">
    <ModalContent>
      <h3>Custom Modal</h3>
    </ModalContent>
  </StatefulModal>
);

export const WithCustomAnimation = () => (
  <StatefulModal
    animation={{
      variants: {
        initial: {
          opacity: 0,
          y: -100,
          transition: {
            ease: 'easeOut',
          },
        },
        animate: {
          y: 0,
          opacity: 1,
          transition: {
            ease: 'easeIn',
          },
        },
        exit: {
          y: 100,
          opacity: 0,
          transition: {
            ease: 'easeOut',
          },
        },
      },
      initial: 'initial',
      animate: 'animate',
      exit: 'exit',
    }}
  >
    <ModalContent>
      <h3>Custom Modal</h3>
    </ModalContent>
  </StatefulModal>
);

export const AlignedToElement = () => {
  const elRef = useRef(null);
  return (
    <div>
      <StatefulModal anchor={elRef}>
        <ModalContent>
          <AlignedOverlayContent>
            <h3>Align to me ⬱</h3>
            <div>↑ Aligned to you ↑</div>
          </AlignedOverlayContent>
        </ModalContent>
      </StatefulModal>
      <AlignmentComponentContent ref={elRef}>
        <h3>Align to me</h3>
      </AlignmentComponentContent>
    </div>
  );
};

const AlignmentComponent: React.FC = () => (
  <AlignmentComponentContent>
    <h3>Balance</h3>
    <h3>Unrealized</h3>
  </AlignmentComponentContent>
);

const OverlayContent: React.FC = () => (
  <OverlayContentWrapper>
    <Form>
      <FormGroup stackable>
        <Label>Data form</Label>
        <Input label="First input" value="" />
        <Input label="Second input" />
        <Input label="Third input" />
      </FormGroup>
    </Form>
  </OverlayContentWrapper>
);

export const Knobs = () => {
  const elRef = useRef(null);
  const animation = select(
    'Animation',
    ['fade', 'slideTop', 'slideBottom'],
    'fade',
  );
  const aligned = boolean('Alined to element', true);
  const duration = number('Animation duration', 0.2);

  return (
    <div>
      <CustomStatefulModal
        anchor={aligned ? elRef : null}
        animation={animation}
        duration={duration}
      >
        <AlignmentComponent />
        <OverlayContent />
      </CustomStatefulModal>
      <div>Drag the component below and open the modal</div>
      <MainComponentWrapper drag ref={elRef}>
        <AlignmentComponent />
      </MainComponentWrapper>
    </div>
  );
};
