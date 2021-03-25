import React from 'react';
import { useIsMobile } from "../hooks/useIsMobile";

export const OnMobile: React.FC = props =>
  useIsMobile() ? <>{props.children}</> : null;
