export const tapAnimation = {
  tap: {
    scale: 0.85,
  },

  error: {
    x: -10,
    transition: {
      yoyo: 5,
      duration: 0.1,
    },
  },
};
export type ActionVariants = keyof typeof tapAnimation | '';

export const TransactionStatus = {
  initial: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
    },
  },
  preview: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
  metaMaskConfirmation: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
  sending: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
  confirmed: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
  failed: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
};
export type TransactionStatusVariants = keyof typeof TransactionStatus;
