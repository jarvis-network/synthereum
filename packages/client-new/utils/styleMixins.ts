import { ThemeConfig } from '@jarvis-network/ui';

const scrollBackgroundColor = {
  night: '#2e3541',
  dark: '#292929',
  light: '#fff',
};

const scrollThumbColor = {
  night: 'rgba(0,0,0,0.3)',
  dark: 'rgba(0,0,0,0.3)',
  light: '#c1c1c1',
};

export const styledScrollbars = (theme: ThemeConfig) => `
  overflow-y: auto;
  scrollbar-color: ${scrollThumbColor[theme.name]} ${
  scrollBackgroundColor[theme.name]
};
  scrollbar-width: thin !important;

  &::-webkit-scrollbar {
    width: 9px;
    background-color: transparent;
  }

  &::-webkit-scrollbar-thumb:vertical {
    background: ${scrollThumbColor[theme.name]};
    background-clip: padding-box;
    border: 2px solid ${scrollBackgroundColor[theme.name]};
    border-right-width: 5px;
    min-height: 10px;
    border-radius: 100px;
  }

  &::-webkit-scrollbar-thumb:vertical:active {
    background: ${scrollThumbColor[theme.name]};
    border: 2px solid ${scrollBackgroundColor[theme.name]};
    border-right-width: 5px;
  }
`;

export const noColorGrid = () => `
  background: none!important;

  .rt-tbody {
    background: none!important;

    .rt-tr-group {
      .rt-tr {
        background: none!important;

        &:hover {
          background: ${props => props.theme.background.secondary} !important;
        }
      }
    }
  }
`;
