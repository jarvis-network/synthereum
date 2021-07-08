import React from 'react';

import { styled } from '../Theme';

import { files } from './files';
import { FlagProps, Size } from './types';

const sizesMap = {
  small: 24,
  medium: 32,
  big: 48,
};

export const getFlagSize = (size: Size = 'medium') => sizesMap[size];

const FlagImage = styled.img<Pick<FlagProps, 'size'>>`
  width: ${props => getFlagSize(props.size)}px;
  height: ${props => getFlagSize(props.size)}px;
`;

export const Flag: React.FC<FlagProps> = ({ flag, ...props }) => (
  <FlagImage alt="" {...props} src={files[flag]} />
);
