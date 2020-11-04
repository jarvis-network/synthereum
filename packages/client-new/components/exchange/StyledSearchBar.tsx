import { SearchBar, styled } from '@jarvis-network/ui';

const StyledSearchBar = styled(SearchBar)`
  input::placeholder,
  .icon {
    color: ${props => props.theme.text.secondary}!important;
  }

  // https://styled-components.com/docs/faqs#how-can-i-override-styles-with-higher-specificity
  // This "&&&" is needed because styled goes crazy and puts ui lib styled and
  // this app styles in random order. When they have the same specificity they
  // in result sometimes gets applied and sometimes not
  &&& input {
    height: 50px;
    box-sizing: border-box;
    font-size: 12px;
    font-family: 'Krub';
    padding: 0 10px;
    background: none;
  }

  .group {
    & > div:first-child {
      padding-left: 30px;
    }
    border: none;
    border-bottom: 1px solid ${props => props.theme.border.secondary};
  }

  margin-bottom: 10px;

  display: flex;
  flex-direction: column;

  ${props => (props.open ? 'height: 100%;' : '')};
`;

export default StyledSearchBar;
