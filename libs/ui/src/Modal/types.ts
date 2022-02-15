import { MotionProps } from 'framer-motion';
import { CSSProperties, ReactNode } from 'react';

export type ModalAnimation = 'fade' | 'slideBottom' | 'slideTop';

export interface ModalProps {
  isOpened?: boolean;
  onClose: (outsideElement?: EventTarget) => void;
  // component to align to
  anchor?: any;
  // customize
  overlayClassName?: string;
  overlayContainerStyle?: CSSProperties;
  overlayStyle?: CSSProperties;
  // animations
  animation?: ModalAnimation | MotionProps;
  duration?: number;
}

export interface ModalContentProps {
  isOpened?: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}
