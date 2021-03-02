import { ButtonModifierProps, ButtonSize } from '../types';

import { ThemeConfig } from '../../Theme/types';
import {
  customButton,
  roundedButton,
  disabledButton,
} from '../../common/mixins';

enum ButtonPadding {
  xxs = '6px 10px',
  xs = '7px 12px',
  s = '8px 14px',
  m = '9px 16px',
  l = '10px 18px',
  xl = '12px 22px',
  xxl = '15px 28px',
  xxxl = '18px 34px',
}

function borderRadius(theme: ThemeConfig, size?: ButtonSize) {
  if (size === 'xl' || size === 'xxl' || size === 'xxxl') {
    return theme.borderRadius.m;
  }

  return theme.borderRadius.s;
}

export const getButtonStyles = (
  props: ButtonModifierProps,
  theme: ThemeConfig,
) => `
  outline: none;
  align-items: center;
  background: ${theme.background.secondary};
  border: 0;
  color: ${theme.text.primary};
  cursor: pointer;
  flex-wrap: wrap;
  font-size: ${theme.font.sizes[props.size || 'xl']};
  font-weight: normal;
  font-family: inherit;
  justify-content: center;
  margin: 0;
  padding: ${ButtonPadding[props.size || 'xl']};
  text-align: left;
  text-decoration: none;
  transition: all 150ms;
  width: max-content;
  border-radius: ${borderRadius(theme, props.size)};

  ${
    props.block
      ? `
        width: 100%;
        text-align: center;
      `
      : ''
  }

  ${
    props.buttonType === 'success'
      ? customButton({
          inverted: props.inverted,
          background: theme.common.success,
          shadow: theme.shadow.base,
          primaryBackground: theme.background.primary,
          color: '#000',
        })
      : ''
  }

  ${
    props.buttonType === 'primary'
      ? customButton({
          inverted: props.inverted,
          background: theme.common.success,
          shadow: theme.shadow.base,
          primaryBackground: theme.background.primary,
          color: theme.text.inverted,
        })
      : ''
  }

  ${
    props.buttonType === 'dark'
      ? customButton({
          inverted: props.inverted,
          background: theme.common.secondary,
          shadow: theme.shadow.dark,
          primaryBackground: theme.background.primary,
          color: theme.text.inverted,
        })
      : ''
  }

  ${
    props.buttonType === 'danger'
      ? customButton({
          inverted: props.inverted,
          background: theme.common.danger,
          shadow: theme.shadow.base,
          primaryBackground: theme.background.primary,
          color: '#fff',
        })
      : ''
  }

  ${
    props.buttonType === 'transparent'
      ? customButton({
          inverted: props.inverted,
          background: theme.background.primary,
          shadow: 'none',
          primaryBackground: theme.text.primary,
          color: theme.text.primary,
        })
      : ''
  }

  ${props.rounded ? roundedButton({ borderRadius: theme.borderRadius.l }) : ''}

  ${
    props.disabled
      ? disabledButton({
          background: theme.background.disabled,
          color: theme.text.secondary,
        })
      : ''
  }
`;
