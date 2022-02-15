import { Variants } from 'framer-motion';

import { ModalAnimation } from './types';

const defaultVariants: { [key: string]: Variants } = {
  fade: {},
  slideBottom: {
    visible: {
      y: 0,
      transition: {
        ease: 'easeIn',
      },
    },
    hidden: {
      y: 500,
      transition: {
        ease: 'easeOut',
      },
    },
  },
  slideTop: {
    visible: {
      y: 0,
      transition: {
        ease: 'easeIn',
      },
    },
    hidden: {
      y: -100,
      transition: {
        ease: 'easeOut',
      },
    },
  },
};

const setTransitionDuration = (variant: any, duration: number) => ({
  ...variant,
  transition: {
    ...variant.transition,
    duration,
  },
});

export const generateAnimation = (type: ModalAnimation, duration: number) => {
  const animation = defaultVariants[type];
  const visible = animation.visible ?? {};
  const hidden = animation.hidden ?? {};

  return {
    variants: {
      visible: {
        opacity: 1,
        ...visible,
        ...setTransitionDuration(visible, duration),
      },
      hidden: {
        opacity: 0,
        ...hidden,
        ...setTransitionDuration(hidden, duration),
      },
    },
    initial: 'hidden',
    animate: 'visible',
    exit: 'hidden',
  };
};
