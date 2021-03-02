import {
  InvertColorsOptions,
  CustomButtonOptions,
  RoundedButtonOptions,
  DisabledButtonOptions,
} from './types';

export const flexRow = () => `
  display: flex;
  flex-direction: row;
`;

export const flexColumn = () => `
  display: flex;
  flex-direction: column;
`;

export const flexBlockCentered = () => `
  align-items: center;
  display: flex;
  justify-content: center;
`;

export const invertColors = ({
  background,
  primaryBackground,
  color,
  inverted,
}: InvertColorsOptions) => `
  background: ${inverted ? primaryBackground : background};
  color: ${inverted ? background : color};

  ${
    inverted
      ? `
    border: 1px solid ${background};
    box-shadow: none;
  `
      : ''
  }
`;

export const customButton = ({ shadow, ...other }: CustomButtonOptions) => `
  box-shadow: ${shadow};
  ${invertColors(other)}
`;
export const roundedButton = ({ borderRadius }: RoundedButtonOptions) => `
  border-radius: ${borderRadius};
`;

export const disabledButton = ({
  background,
  color,
}: DisabledButtonOptions) => `
  cursor: not-allowed;
  background: ${background};
  color: ${color};
`;

export const styledScrollbars = (thumb: string, background: string) => `
  overflow-y: auto;
  scrollbar-color: ${thumb} ${background};
  scrollbar-width: thin !important;

  &::-webkit-scrollbar {
    width: 9px;
    background-color: transparent;
  }

  &::-webkit-scrollbar-thumb:vertical {
    background: ${thumb};
    background-clip: padding-box;
    border: 2px solid ${background};
    border-right-width: 5px;
    min-height: 10px;
    border-radius: 100px;
  }

  &::-webkit-scrollbar-thumb:vertical:active {
    background: ${thumb};
    border: 2px solid ${background};
    border-right-width: 5px;
  }
`;
