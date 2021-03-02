import React, { FC, CSSProperties } from 'react';
import {
  IoIosArrowBack,
  IoIosArrowDown,
  IoIosArrowForward,
  IoIosArrowRoundBack,
  IoIosArrowRoundDown,
  IoIosArrowRoundForward,
  IoIosArrowRoundUp,
  IoIosArrowUp,
  IoIosClose,
  IoIosEye,
  IoIosEyeOff,
  IoIosHelpCircleOutline,
  IoIosMenu,
  IoIosQrScanner,
  IoIosSearch,
  IoIosSwap,
  IoMdClose,
  IoMdLogOut,
  IoMdOpen,
  IoMdSearch,
  IoIosSunny,
  IoIosMoon,
  IoIosCloud,
  IoIosCloudyNight,
} from 'react-icons/io';
import {
  BsArrowLeft,
  BsArrowRight,
  BsCheck,
  BsChevronDown,
  BsChevronRight,
  BsDownload,
  BsPencil,
  BsPlus,
  BsTrash,
  BsUpload,
  BsThreeDots,
  BsQuestion,
} from 'react-icons/bs';
import {
  SiApple,
  SiDiscord,
  SiFacebook,
  SiGithub,
  SiGoogle,
  SiLinkedin,
  SiReddit,
  SiTwitch,
  SiTwitter,
} from 'react-icons/si';

import { styled } from '../Theme';

export const icons = {
  BsArrowLeft,
  BsArrowRight,
  BsCheck,
  BsChevronDown,
  BsChevronRight,
  BsDownload,
  BsPencil,
  BsPlus,
  BsTrash,
  BsUpload,
  BsThreeDots,
  BsQuestion,
  IoIosArrowBack,
  IoIosArrowDown,
  IoIosArrowForward,
  IoIosArrowRoundBack,
  IoIosArrowRoundDown,
  IoIosArrowRoundForward,
  IoIosArrowRoundUp,
  IoIosArrowUp,
  IoIosClose,
  IoIosEye,
  IoIosEyeOff,
  IoIosHelpCircleOutline,
  IoIosMenu,
  IoIosQrScanner,
  IoIosSearch,
  IoIosSwap,
  IoIosMoon,
  IoIosSunny,
  IoIosCloud,
  IoIosCloudyNight,
  IoMdClose,
  IoMdLogOut,
  IoMdOpen,
  IoMdSearch,
  SiApple,
  SiDiscord,
  SiFacebook,
  SiGithub,
  SiGoogle,
  SiLinkedin,
  SiReddit,
  SiTwitch,
  SiTwitter,
};

export type IconKeys = keyof typeof icons;

interface IconProps {
  icon: IconKeys;
  className?: string;
  style?: CSSProperties;
}

export const IconContainer = styled.i`
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

export const Icon: FC<IconProps> = ({ icon, className, style = {} }) => {
  const IconComponent = icons[icon];

  return (
    <IconContainer className={className} style={style}>
      <IconComponent />
    </IconContainer>
  );
};
