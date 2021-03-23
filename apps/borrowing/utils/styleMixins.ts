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

interface Overrides {
  thumb?: string;
  background?: string;
}

export const styledScrollbars = (
  theme: ThemeConfig,
  overrides: Overrides = {},
) => `
  overflow-y: auto;
  scrollbar-color: ${overrides.thumb ?? scrollThumbColor[theme.name]} ${
  overrides.background ?? scrollBackgroundColor[theme.name]
};
  scrollbar-width: thin !important;

  &::-webkit-scrollbar {
    width: 9px;
    background-color: transparent;
  }

  &::-webkit-scrollbar-thumb:vertical {
    background: ${overrides.thumb ?? scrollThumbColor[theme.name]};
    background-clip: padding-box;
    border: 2px solid ${
      overrides.background ?? scrollBackgroundColor[theme.name]
    };
    border-right-width: 5px;
    min-height: 10px;
    border-radius: 100px;
  }

  &::-webkit-scrollbar-thumb:vertical:active {
    background: ${overrides.thumb ?? scrollThumbColor[theme.name]};
    border: 2px solid ${
      overrides.background ?? scrollBackgroundColor[theme.name]
    };
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
          background: ${(props: any) =>
            props.theme.background.secondary} !important;
        }
      }
    }
  }
`;
