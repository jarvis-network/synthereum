import React from 'react';

import { Emoji as EmojiList, EmojiKeys } from './types';

export interface EmojiProps {
  emoji: EmojiKeys;
}

export const Emoji: React.FC<EmojiProps> = ({ emoji, ...props }) => (
  <span {...props}>{EmojiList[emoji]}</span>
);
