import React, { FC, forwardRef, useImperativeHandle, useState } from 'react';
import { motion, AnimateSharedLayout, HTMLMotionProps } from 'framer-motion';

import { styled, FontSizeType } from '../Theme';
import { flexRow } from '../common/mixins';

import { TabsProps } from './types';

const TABS_BORDER_SIZE = 1;
// const TABS_POINTER_WIDTH = 25;
// const TABS_POINTER_HEIGHT = 3;
const TABS_SPACE = 25;

const Container = styled.div`
  height: 100%;
  border-radius: ${props => props.theme.borderRadius.m};
`;

const TabsContainer = styled.div`
  display: inline-grid;
  align-content: center;
  border: ${TABS_BORDER_SIZE}px solid ${props => props.theme.border.primary};
  height: ${props => props.theme.sizes.row};
  justify-content: space-between;
  line-height: ${props => props.theme.sizes.row};
  margin: 0px auto;
  border-radius: ${props => props.theme.borderRadius.m};
  .active {
    color: ${props => props.theme.text.inverted};
    z-index: 50;
    position: relative;
  }
`;

const TabsWrapper = styled.div`
  ${flexRow()}
  justify-content: center;
  width: 100%;
`;

const TabContent = styled.div`
  height: calc(100% - ${props => props.theme.sizes.row});
`;

const TabButton = styled.div<{ isPre?: boolean }>`
  cursor: pointer;
  padding: 0px 10px;
  position: relative;
  color: ${props => props.theme.text.primary};
`;

const TabPre = styled.div``;

const TabExtra = styled.div`
  margin-right: ${TABS_SPACE}px;
`;

const CustomMotionDiv: FC<
  { active?: boolean; fontSize: FontSizeType } & HTMLMotionProps<'div'>
> = props => <motion.div {...props} />;

const TabTitle = styled(CustomMotionDiv)`
  color: ${props => props.theme.text.primary};
  font-size: ${props => props.theme.font.sizes[props.fontSize]};
  font-weight: 300;
  margin: 0;

  ${props => (props.active ? `color: ${props.theme.text.primary};` : '')};
`;

const TabPointer = styled(motion.div)`
  background: ${props => props.theme.background.inverted};
  left: 0%;
  z-index: 0;
  top: 0px;
  position: absolute;
  width: 100%;
  height: ${props => props.theme.sizes.row};
  border-radius: ${props => props.theme.borderRadius.m};
`;

export type ButtonHandler = {
  updateTab: (index: number) => void;
};
const RefTabs = forwardRef<ButtonHandler, TabsProps>(
  (
    {
      tabs = [],
      pointerPosition = 'center',
      layout = 'TOP-BOTTOM',
      pointer = true,
      extra,
      pre,
      selected: initialSelected = 0,
      onChange,
      titleFontSize,
      ...props
    },
    ref,
  ) => {
    const style = () => {
      if (pointerPosition !== 'center') {
        return {
          left: `0`,
        };
      }
      return {};
    };

    const [selected, setSelected] = useState(initialSelected);

    if (selected && selected >= tabs.length) {
      // If the last tab was selected and the number of tabs is decreased,
      // select the last available tab, or set the `selected` variable to -1
      // (which is handled fine).
      setSelected(tabs.length - 1);
    }
    useImperativeHandle(ref, () => ({
      updateTab: (index: number) => {
        setSelected(index);
      },
    }));
    return (
      <Container {...props}>
        {layout === 'BOTTOM-TOP' ? (
          <TabContent>{tabs[selected]?.content}</TabContent>
        ) : null}
        <TabsContainer>
          {pre && <TabPre>{pre}</TabPre>}
          <TabsWrapper>
            <AnimateSharedLayout>
              {tabs.map(({ title }, index) => (
                <TabButton
                  role="button"
                  key={title}
                  isPre={!!pre && index === 0}
                  onClick={() => {
                    setSelected(index);
                    if (onChange) onChange(index);
                  }}
                >
                  <TabTitle
                    animate
                    active={selected === index}
                    fontSize={titleFontSize || 'l'}
                    className={selected === index ? 'active' : ''}
                  >
                    <span>{title}</span>
                  </TabTitle>
                  {pointer && index === selected && (
                    <TabPointer layoutId="pointer" style={style()} />
                  )}
                </TabButton>
              ))}
            </AnimateSharedLayout>
          </TabsWrapper>
          {extra && <TabExtra>{extra}</TabExtra>}
        </TabsContainer>
        {layout === 'TOP-BOTTOM' ? (
          <TabContent>{tabs[selected]?.content}</TabContent>
        ) : null}
      </Container>
    );
  },
);
export const SwitchTabs = React.memo(RefTabs);
