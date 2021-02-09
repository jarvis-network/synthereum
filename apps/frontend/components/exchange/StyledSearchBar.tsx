import { SearchBar, styled, themeValue } from '@jarvis-network/ui';

export const StyledSearchBar = styled(SearchBar)<{ open?: boolean }>`
  input::placeholder,
  .icon {
    color: ${themeValue(
      {
        light: theme => theme.text.secondary,
      },
      theme => theme.text.medium,
    )}!important;
  }

  // https://styled-components.com/docs/faqs#how-can-i-override-styles-with-higher-specificity
  // This "&&&" is needed because styled goes crazy and puts ui lib styled and
  // this app styles in random order. When they have the same specificity they
  // in result sometimes gets applied and sometimes not
  &&& input {
    box-sizing: border-box;
    font-size: ${props => props.theme.font.sizes.m};
    font-family: 'Krub';
    padding: 0 10px;
    background: none;
    height: ${props => props.theme.sizes.row};
  }

  .group {
    & > div:first-child {
      padding-left: 30px;
    }
    & > div:nth-child(3) {
      padding-right: 30px;
    }
    border: none;
    border-bottom: 1px solid ${props => props.theme.border.secondary};
  }

  display: flex;
  flex-direction: column;

  ${props => (props.open ? 'height: 100%; max-height: 426px;' : '')};
`;
