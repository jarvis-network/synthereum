import React from 'react';

import { styled } from '../Theme';

import { files, questionMark } from './files';
import { FlagProps, Size } from './types';

const sizesMap = {
  small: 16,
  medium: 32,
  big: 48,
};

const getSize = (size: Size = 'medium') => sizesMap[size];

const FlagImage = styled.img<Pick<FlagProps, 'size'>>`
  width: ${props => getSize(props.size)}px;
  height: ${props => getSize(props.size)}px;
`;

export const Flag: React.FC<FlagProps> = ({ flag, ...props }) => (
  <FlagImage
    alt=""
    {...props}
    src={(files[flag as keyof typeof files] as string) || questionMark}
  />
);
