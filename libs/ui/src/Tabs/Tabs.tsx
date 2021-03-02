import React, { FC, forwardRef, useState } from 'react';
import { motion, AnimateSharedLayout, HTMLMotionProps } from 'framer-motion';

import { styled, FontSizeType } from '../Theme';
import { flexRow } from '../common/mixins';

import { TabsProps } from './types';

const TABS_BORDER_SIZE = 1;
const TABS_POINTER_WIDTH = 25;
const TABS_POINTER_HEIGHT = 3;
const TABS_SPACE = 25;

const Container = styled.div`
  height: 100%;
  border-radius: ${props => props.theme.borderRadius.m};
`;

const TabsContainer = styled.div`
  ${flexRow()}

  align-content: center;
  background: ${props => props.theme.background.secondary};
  border-bottom: ${TABS_BORDER_SIZE}px solid
    ${props => props.theme.border.secondary};
  height: ${props => props.theme.sizes.row};
  justify-content: space-between;
  line-height: ${props => props.theme.sizes.row};
  width: 100%;
  border-radius: ${props => props.theme.borderRadius.m}
    ${props => props.theme.borderRadius.m} 0 0;
`;

const TabsWrapper = styled.div`
  ${flexRow()}
  justify-content: flex-start;
  width: 100%;
`;

const TabContent = styled.div`
  height: calc(100% - ${props => props.theme.sizes.row});
`;

const TabButton = styled.div<{ isPre?: boolean }>`
  cursor: pointer;
  margin-left: ${props => (props.isPre ? 0 : TABS_SPACE)}px;
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
  color: ${props => props.theme.text.secondary};
  font-size: ${props => props.theme.font.sizes[props.fontSize]};
  font-weight: 300;
  margin: 0;

  ${props => (props.active ? `color: ${props.theme.text.primary};` : '')};
`;

const TabPointer = styled(motion.div)`
  border-bottom: ${TABS_POINTER_HEIGHT}px solid
    ${props => props.theme.common.success};
  bottom: -${TABS_POINTER_HEIGHT / 2}px;
  left: 50%;
  margin-left: -${TABS_POINTER_WIDTH / 2}px;
  position: absolute;
  width: ${TABS_POINTER_WIDTH}px;
`;

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      tabs = [],
      pointerPosition = 'center',
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
          left: `${pointerPosition}`,
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

    return (
      <Container {...props}>
        <TabsContainer ref={ref}>
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
        <TabContent>{tabs[selected]?.content}</TabContent>
      </Container>
    );
  },
);
