import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import useKeyPressed from '../hooks/useKeyPressed';
import { styled } from '../Theme';

import { ModalProps } from './types';
import { generateAnimation } from './helpers';

const Container = styled(motion.div)`
  align-items: center;
  background: rgba(0, 0, 0, 0.5);
  bottom: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: center;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  width: 100%;
  z-index: 150;
`;

const Overlay = styled(motion.div)`
  height: 100%;

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1] + 1}px) {
    height: auto;
  }
`;

export const Modal: React.FC<ModalProps> = ({
  isOpened = false,
  onClose,
  anchor,
  overlayClassName,
  overlayStyle = {},
  animation = 'fade',
  duration = 0.2,
  children,
}) => {
  const overlayAnimation = useMemo(() => generateAnimation('fade', duration), [
    duration,
  ]);
  const modalAnimation = useMemo(
    () =>
      typeof animation === 'object'
        ? animation
        : generateAnimation(animation, duration),
    [animation, duration],
  );

  const [modalPosition, setModalPosition] = useState({});
  const escaped = useKeyPressed('escape');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (escaped && isOpened) onClose();
  }, [escaped, isOpened, onClose]);

  useEffect(() => {
    if (!anchor || !anchor.current) {
      setModalPosition({});
      return;
    }

    const { left, top } = anchor.current!.getBoundingClientRect();
    setModalPosition({ left, top });
  }, [isOpened, anchor]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!isOpened) {
        return;
      }

      const isContentClicked = contentRef?.current?.contains(
        event.target as Node | null,
      );

      if (isContentClicked) {
        return;
      }

      onClose(event.target || undefined);
    }

    document.addEventListener('mousedown', handleClickOutside, false);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, false);
    };
  }, [contentRef, isOpened]);

  return (
    <AnimatePresence>
      {isOpened && (
        <Container
          className={overlayClassName || ''}
          style={overlayStyle || {}}
          {...overlayAnimation}
        >
          <Overlay
            style={{
              ...modalPosition,
              zIndex: 2001,
              position: 'absolute',
            }}
            ref={contentRef}
            {...modalAnimation}
          >
            {children}
          </Overlay>
        </Container>
      )}
    </AnimatePresence>
  );
};
