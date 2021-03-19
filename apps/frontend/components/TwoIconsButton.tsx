import { styled } from '@jarvis-network/ui';

export const TwoIconsButton = styled.button`
  border: none;
  padding: 0;
  background: none;
  cursor: pointer;
  outline: none !important;
  width: 100%;
  transform: translateY(14px);

  svg {
    width: 24px;
    height: 24px;
    margin-left: -8px;
    margin-right: -8px;
    fill: ${props => props.theme.text.secondary};
  }
`;
