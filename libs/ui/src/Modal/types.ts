import { CSSProperties, ReactNode } from 'react';
import { MotionProps } from 'framer-motion';

export type ModalAnimation = 'fade' | 'slideBottom' | 'slideTop';

export interface ModalProps {
  isOpened?: boolean;
  onClose: (outsideElement?: EventTarget) => void;
  // component to align to
  anchor?: any;
  // customize
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
  // animations
  animation?: ModalAnimation | MotionProps;
  duration?: number;
  useDisplayNone?: boolean;
}

export interface ModalContentProps {
  isOpened?: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  id?: string;
  useDisplayNone?: boolean;
}
