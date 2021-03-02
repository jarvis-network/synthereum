import React, { FC, useState, useRef, useEffect } from 'react';

import { styled } from '../Theme';

import { DropdownProps, Position } from './types';

const Container = styled.div<{
  isVisible: boolean;
  width: DropdownProps['width'];
  useBoxShadow: boolean;
  useBorder: boolean;
  position: Position;
}>`
  width: ${props => props.width || '100%'};
  box-shadow: ${props =>
    props.isVisible && props.useBoxShadow && props.position !== 'absolute'
      ? props.theme.shadow.base
      : 'none'};
  border-bottom: ${props =>
    props.useBorder ? `1px solid ${props.theme.background.medium}` : 'none'};
  border-radius: ${props => props.theme.borderRadius.s};

  ${props => (props.position === 'absolute' ? 'position: relative;' : '')}

  :last-child {
    border-bottom: none;
  }
`;

const Header = styled.div<{ isVisible: boolean }>`
  border-radius: ${props => props.theme.borderRadius.s};
`;

const Content = styled.div<{
  isVisible: boolean;
  contentOnTop: boolean;
  position: Position;
}>`
  display: ${props => (props.isVisible ? 'flex' : 'none')};
  border-radius: ${props => props.theme.borderRadius.s};

  ${props =>
    props.position === 'absolute'
      ? 'position: absolute; left: 0; right: 0; z-index: 1;'
      : ''};

  ${props =>
    props.position === 'absolute' && props.contentOnTop
      ? 'bottom: 100%;'
      : 'bottom: auto;'};
`;

/**
 * This is simplest dropdown implementation
 * In case of advanced dropdown usage don't extend current
 * Use https://github.com/popperjs/react-popper with existing interface
 */
export const Dropdown: FC<DropdownProps> = ({
  width,
  header,
  children,
  blockOutsideCollapse = false,
  isExpanded = false,
  useBoxShadow = true,
  useBorder = false,
  contentOnTop = false,
  setExpanded,
  position = 'static',
  className,
  style,
}) => {
  const [isOpenInternal, setOpenInternal] = useState(isExpanded);
  const [isOpen, setOpen] = setExpanded
    ? [isExpanded, setExpanded]
    : [isOpenInternal, setOpenInternal];

  const ref = useRef<HTMLDivElement>(null);

  const toggleOpen = () => setOpen(!isOpen);

  useEffect(() => {
    if (blockOutsideCollapse) {
      return () => {}; // fix for consistent-return eslint rule
    }

    function handleClickOutside(event: MouseEvent) {
      const isDropdownClicked = ref?.current?.contains(
        event.target as Node | null,
      );

      if (!isOpen) {
        return;
      }

      if (isDropdownClicked) {
        return;
      }

      setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside, false);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, false);
    };
  }, [blockOutsideCollapse, ref, isOpen]);

  const cls = `dropdown ${className || ''}`;

  return (
    <Container
      position={position}
      isVisible={isOpen}
      style={style || {}}
      width={width}
      useBoxShadow={useBoxShadow}
      useBorder={useBorder}
      className={cls}
      ref={ref}
    >
      <Header isVisible={isOpen} onClick={toggleOpen}>
        {header}
      </Header>
      <Content
        isVisible={isOpen}
        position={position}
        className="dropdown-content"
        contentOnTop={contentOnTop}
      >
        {children}
      </Content>
    </Container>
  );
};
